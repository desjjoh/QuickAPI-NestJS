import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import {
  AuditActorType,
  AuditEventDomain,
  AuditResourceType,
  AuditSource,
  AuditSubjectType,
  IdentityAuditEvents,
} from '@/config/audit-events.config';

import { RequestContext } from '@/common/store/request-context.store';
import {
  PaginationDto,
  PaginationMeta,
} from '@/common/models/pagination.model';

import { AuditService } from '@/modules/domain/audit/services/audit.service';
import {
  UserDto,
  UserPaginationOptions,
} from '@/modules/domain/identity/models/user.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserAdministrationService } from '@/modules/domain/identity/services/user-administration.service';
import { UserLifecycleService } from '@/modules/domain/identity/services/user-lifecycle.service';

import { UpdateUserAdministrationDto } from '../models/update-user.model';
import { AdministrationActionDto } from '../models/administration-action.model';

@Injectable()
export class UserAdminService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly userAdministration: UserAdministrationService,
    private readonly lifecycle: UserLifecycleService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
  ) {}

  public async paginateUsers(
    pageOptions: UserPaginationOptions,
  ): Promise<PaginationDto<UserDto>> {
    const [response, itemCount] = await this.userSvc.paginate(pageOptions);

    return new PaginationDto(
      response.map((e: UserEntity) => new UserDto(e)),
      new PaginationMeta({ pageOptions, itemCount }),
    );
  }

  public async findUser(id: string): Promise<UserDto> {
    return new UserDto(await this.userSvc.findByIdOrFail(id));
  }

  public async removeUser(
    id: string,
    dto: AdministrationActionDto,
  ): Promise<void> {
    await this.userSvc.transaction(async (manager, lifecycle) => {
      const before = await this.lockUser(manager, id);
      await this.lifecycle.deleteUser(before, manager, lifecycle);
      await this.audit.record(
        this.successInput(
          IdentityAuditEvents.ADMIN_USER_DELETED,
          id,
          this.auditSnapshot(before),
          null,
          dto.reason_code,
        ),
        manager,
      );
    });
  }

  public async updateUser(
    id: string,
    dto: UpdateUserAdministrationDto,
  ): Promise<UserDto> {
    const user = await this.userSvc.transaction(async (manager) => {
      const before = await this.lockUser(manager, id);
      const after = await this.userAdministration.updateAdministration(
        before,
        dto,
        manager,
      );
      await this.audit.record(
        this.successInput(
          IdentityAuditEvents.ADMIN_USER_UPDATED,
          id,
          this.auditSnapshot(before),
          this.auditSnapshot(after),
          dto.reason_code,
        ),
        manager,
      );
      return after;
    });
    return new UserDto(user);
  }

  /** The pessimistic read makes the captured before value part of the mutation transaction. */
  private async lockUser(
    manager: EntityManager,
    id: string,
  ): Promise<UserEntity> {
    return manager.findOneOrFail(UserEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private successInput(
    event: IdentityAuditEvents,
    id: string,
    before: unknown,
    after: unknown,
    reasonCode: string,
  ) {
    const actorId = this.context.get('actorId') ?? null;

    return {
      domain: AuditEventDomain.IDENTITY,
      event,
      actorType: AuditActorType.ADMIN,
      actorId,
      subjectType: AuditSubjectType.USER,
      subjectId: id,
      resourceType: AuditResourceType.IDENTITY_USER,
      resourceId: id,
      source: AuditSource.HTTP,
      metadata: {
        reason_code: reasonCode,
      },
      before,
      after,
    };
  }

  private auditSnapshot(user: UserEntity) {
    return {
      id: user.id,
      status: { id: user.status.id },
      roles: user.roles?.map(({ id }) => id) ?? [],
    };
  }
}
