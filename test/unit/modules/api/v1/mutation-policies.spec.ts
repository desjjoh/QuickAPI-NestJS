import { RequestMethod, type Type } from '@nestjs/common';
import {
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import type { Routes } from '@nestjs/core';
import { ApiV1Module, apiV1Routes } from '@/modules/api/v1/v1.module';
import { TransactionInterceptor } from '@/common/interceptors/transaction.interceptor';
import { IdempotencyInterceptor } from '@/common/interceptors/idempotency.interceptor';
import { SecurityTransactionInterceptor } from '@/common/interceptors/security-transaction.interceptor';
import { ProfileApiController } from '@/modules/api/v1/account/controllers/profile.controller';
import { PERMISSIONS_KEY } from '@/common/decorators/permissions.decorator';
import { AccountManagementPermissions } from '@/config/permissions.config';
import {
  IDEMPOTENCY_OPERATION,
  SECURITY_OPERATION,
} from '@/common/constants/request-operation.constants';

function moduleControllers(module: Type<object>): Type<object>[] {
  return (
    (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) as
      | Type<object>[]
      | undefined) ?? []
  );
}

function routedControllers(
  routes: ReadonlyArray<Routes[number] | Type<object>>,
): Type<object>[] {
  return routes.flatMap((route) => {
    if (typeof route === 'function') return moduleControllers(route);

    return [
      ...(route.module ? moduleControllers(route.module) : []),
      ...routedControllers(route.children ?? []),
    ];
  });
}

const controllers = new Set<Type<object>>([
  ...((Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ApiV1Module) as
    | Type<object>[]
    | undefined) ?? []),
  ...routedControllers(apiV1Routes),
]);
const mutations = [...controllers].flatMap((controller) =>
  Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      controller.prototype,
      name,
    )?.value;

    if (typeof handler !== 'function') return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as
      | RequestMethod
      | undefined;

    return method !== undefined &&
      [
        RequestMethod.POST,
        RequestMethod.PUT,
        RequestMethod.PATCH,
        RequestMethod.DELETE,
      ].includes(method)
      ? [{ name: `${controller.name}.${name}`, controller, handler }]
      : [];
  }),
);

describe('HTTP mutation policy inventory', () => {
  it('discovers the mounted mutation controllers', () => {
    expect(mutations.length).toBeGreaterThan(0);
  });

  it.each(mutations)(
    '$name declares a transaction boundary',
    ({ controller, handler }) => {
      const interceptors: unknown[] = [
        ...((Reflect.getMetadata(INTERCEPTORS_METADATA, controller) as
          | unknown[]
          | undefined) ?? []),
        ...((Reflect.getMetadata(INTERCEPTORS_METADATA, handler) as
          | unknown[]
          | undefined) ?? []),
      ];

      expect(
        interceptors.some(
          (interceptor) =>
            interceptor === TransactionInterceptor ||
            interceptor === IdempotencyInterceptor ||
            interceptor === SecurityTransactionInterceptor,
        ),
      ).toBe(true);
    },
  );

  it.each(mutations)(
    '$name does not mix credential security with response replay',
    ({ controller, handler }) => {
      const security =
        Reflect.getMetadata(SECURITY_OPERATION, handler) ??
        Reflect.getMetadata(SECURITY_OPERATION, controller);
      const replay =
        Reflect.getMetadata(IDEMPOTENCY_OPERATION, handler) ??
        Reflect.getMetadata(IDEMPOTENCY_OPERATION, controller);

      expect(Boolean(security && replay)).toBe(false);
    },
  );

  it.each(
    mutations.filter(({ controller }) => controller === ProfileApiController),
  )('$name consistently requires account-update permission', ({ handler }) => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toContain(
      AccountManagementPermissions.UPDATE_ACCOUNT,
    );
  });

  it.each([
    ['updateProfile', 'identity.profile.personal_information.update'],
    ['updateCountry', 'identity.profile.country.update'],
    ['updateTimezone', 'identity.profile.timezone.update'],
  ] as const)(
    'protects profile setting %s with its own replay operation',
    (method, operation) => {
      expect(
        Reflect.getMetadata(
          IDEMPOTENCY_OPERATION,
          ProfileApiController.prototype[method],
        ),
      ).toBe(operation);
    },
  );
});
