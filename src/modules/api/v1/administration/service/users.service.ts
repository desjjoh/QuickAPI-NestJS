import {
  AuditResourceType,
  AuditSubjectType,
} from '@/config/audit-events.config';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { RequestContext } from '@/common/store/request-context.store';
import { IdentityAuditEvents } from '@/config/audit-events.config';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import {
  UserDto,
  UserPaginationOptions,
} from '@/modules/domain/identity/models/user.model';
import {
  PaginationDto,
  PaginationMeta,
} from '@/common/models/pagination.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UpdateUserAdministrationDto } from '../models/update-user.model';
import { AdministrationActionDto } from '../models/administration-action.model';

@Injectable()
export class UserAdminService {
  public constructor(
    private readonly repo: UserRepository,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
  ) {}

  public async paginateUsers(
    pageOptions: UserPaginationOptions,
  ): Promise<PaginationDto<UserDto>> {
    const [response, itemCount] = await this.repo.paginate(pageOptions);

    return new PaginationDto(
      response.map((e: UserEntity) => new UserDto(e)),
      new PaginationMeta({ pageOptions, itemCount }),
    );
  }

  public async findUser(id: string): Promise<UserDto> {
    return new UserDto(await this.repo.findByIdOrFail(id));
  }

  public async removeUser(
    id: string,
    dto: AdministrationActionDto,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const before = await this.lockUser(manager, id);
      await this.repo.removeUser(id, manager);
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
    const user = await this.dataSource.transaction(async (manager) => {
      const before = await this.lockUser(manager, id);
      const after = await this.repo.updateUserAdministration(id, dto, manager);
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
      domain: 'identity',
      event,
      outcome: 'succeeded' as const,
      actorType: 'admin' as const,
      actorId,
      subjectType: AuditSubjectType.USER,
      subjectId: id,
      resourceType: AuditResourceType.IDENTITY_USER,
      resourceId: id,
      source: 'http' as const,
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
