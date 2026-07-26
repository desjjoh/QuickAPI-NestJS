import {
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { env } from '@/config/environment.config';
import {
  DiagnosticsOperationsGuard,
  MetricsOperationsGuard,
} from './operations.guard';

function context(key?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name === 'x-operations-key' ? key : undefined,
      }),
    }),
  } as ExecutionContext;
}

describe('operations endpoint guards', () => {
  const original = {
    NODE_ENV: env.NODE_ENV,
    METRICS_ENABLED: env.METRICS_ENABLED,
    DETAILED_DIAGNOSTICS_ENABLED: env.DETAILED_DIAGNOSTICS_ENABLED,
    OPERATIONS_TOKEN: env.OPERATIONS_TOKEN,
  };

  afterEach(() => Object.assign(env, original));

  it('bypasses feature and credential checks in development', () => {
    Object.assign(env, {
      NODE_ENV: 'development',
      METRICS_ENABLED: false,
      OPERATIONS_TOKEN: undefined,
    });

    expect(new MetricsOperationsGuard().canActivate(context())).toBe(true);
  });

  it.each([
    [new MetricsOperationsGuard(), 'METRICS_ENABLED'],
    [new DiagnosticsOperationsGuard(), 'DETAILED_DIAGNOSTICS_ENABLED'],
  ] as const)('hides a disabled endpoint', (guard, setting) => {
    Object.assign(env, {
      NODE_ENV: 'production',
      [setting]: false,
      OPERATIONS_TOKEN: 'a'.repeat(32),
    });
    expect(() => guard.canActivate(context())).toThrow(NotFoundException);
  });

  it('rejects missing and invalid operations credentials', () => {
    Object.assign(env, {
      NODE_ENV: 'production',
      METRICS_ENABLED: true,
      OPERATIONS_TOKEN: 'a'.repeat(32),
    });
    const guard = new MetricsOperationsGuard();

    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('b'.repeat(32)))).toThrow(
      UnauthorizedException,
    );
  });

  it('authorizes the deployment operations credential', () => {
    const token = 'a'.repeat(32);
    Object.assign(env, {
      NODE_ENV: 'production',
      DETAILED_DIAGNOSTICS_ENABLED: true,
      OPERATIONS_TOKEN: token,
    });

    expect(new DiagnosticsOperationsGuard().canActivate(context(token))).toBe(
      true,
    );
  });
});
