import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditSubjectType } from '@/config/audit-events.config';
import { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import {
  AccountActivityEventDto,
  AccountActivityPageDto,
  AccountActivityQueryDto,
} from '../models/activity.model';

@Injectable()
export class ActivityApiService {
  public constructor(private readonly auditQueries: AuditQueryService) {}

  public async findForUser(
    user: UserEntity,
    query: AccountActivityQueryDto,
  ): Promise<AccountActivityPageDto> {
    if (
      query.occurredFrom &&
      query.occurredTo &&
      query.occurredFrom > query.occurredTo
    )
      throw new BadRequestException('occurredFrom must not follow occurredTo');

    const result = await this.auditQueries.query({
      subjectType: AuditSubjectType.USER,
      subjectId: user.id,
      domain: query.domain,
      event: query.event,
      outcome: query.outcome,
      occurredFrom: query.occurredFrom,
      occurredTo: query.occurredTo,
      page: query.page,
      take: query.take,
    });
    const data = result.data.map((event) => new AccountActivityEventDto(event));
    return new AccountActivityPageDto(data, result.meta);
  }
}
