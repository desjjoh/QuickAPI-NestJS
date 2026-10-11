import { isUserDeleted } from '@/modules/domain/identity/policies/user-deletion.policy';
import { Injectable, NotFoundException } from '@nestjs/common';
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
import { UserPaginationOptions } from '@/modules/domain/identity/models/user.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserAdministrationService } from '@/modules/domain/identity/services/user-administration.service';
import { UserLifecycleService } from '@/modules/domain/identity/services/user-lifecycle.service';

import { UpdateUserAdministrationDto } from '../models/update-user.model';
import { UserAdministrationActionDto } from '../models/user-action.model';
import { UserAdministrationDto } from '@/modules/domain/identity/models/user-administration.model';
import { assertUserAdministrationVersion } from '@/modules/domain/identity/policies/user-administration-version.policy';
import { identityUserSnapshot } from '@/modules/domain/audit/snapshots/identity-audit.snapshot';

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
  ): Promise<PaginationDto<UserAdministrationDto>> {
    const [response, itemCount] = await this.userSvc.paginate(pageOptions);

    return new PaginationDto(
      response.map((e: UserEntity) => new UserAdministrationDto(e)),
      new PaginationMeta({ pageOptions, itemCount }),
    );
  }

  public async findUser(id: string): Promise<UserAdministrationDto> {
    return new UserAdministrationDto(await this.userSvc.findByIdOrFail(id));
  }

  public async removeUser(
    id: string,
    dto: UserAdministrationActionDto,
  ): Promise<void> {
    await this.userSvc.transaction(async (manager, lifecycle) => {
      const before = await this.lockUser(manager, id);
      assertUserAdministrationVersion(before, dto.expected_version);
      const beforeSnapshot = this.auditSnapshot(before);
      await this.lifecycle.deleteUser(before, manager, lifecycle);
      const after = await manager.findOneOrFail(UserEntity, { where: { id } });
      await this.audit.record(
        this.successInput(
          IdentityAuditEvents.ADMIN_USER_DELETED,
          id,
          beforeSnapshot,
          this.auditSnapshot(after),
          dto.reason_code,
        ),
        manager,
      );
    });
  }

  public async updateUser(
    id: string,
    dto: UpdateUserAdministrationDto,
  ): Promise<UserAdministrationDto> {
    const user = await this.userSvc.transaction(async (manager) => {
      const before = await this.lockUser(manager, id);
      assertUserAdministrationVersion(before, dto.expected_version);
      const beforeSnapshot = this.auditSnapshot(before);
      const after = await this.userAdministration.updateAdministration(
        before,
        dto,
        manager,
      );
      await this.audit.record(
        this.successInput(
          IdentityAuditEvents.ADMIN_USER_UPDATED,
          id,
          beforeSnapshot,
          this.auditSnapshot(after),
          dto.reason_code,
        ),
        manager,
      );
      return after;
    });
    return new UserAdministrationDto(user);
  }

  /** The pessimistic read makes the captured before value part of the mutation transaction. */
  private async lockUser(
    manager: EntityManager,
    id: string,
  ): Promise<UserEntity> {
    const user = await manager.findOneOrFail(UserEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (isUserDeleted(user)) throw new NotFoundException('User not found.');
    return user;
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
      includeSnapshotContext: event === IdentityAuditEvents.ADMIN_USER_DELETED,
    };
  }

  private auditSnapshot(user: UserEntity) {
    return identityUserSnapshot(user);
  }
}
