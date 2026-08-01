import { AuditSubjectType } from '@/config/audit-events.config';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import {
  UserActivityEventDto,
  UserActivityPageDto,
  UserActivityQueryDto,
} from '../models/user-activity.model';

@Injectable()
export class UserActivityAdminService {
  public constructor(private readonly auditQueries: AuditQueryService) {}

  public async findForUser(
    userId: string,
    query: UserActivityQueryDto,
  ): Promise<UserActivityPageDto> {
    if (
      query.occurredFrom &&
      query.occurredTo &&
      query.occurredFrom > query.occurredTo
    )
      throw new BadRequestException('occurredFrom must not follow occurredTo');

    const result = await this.auditQueries.query({
      subjectType: AuditSubjectType.USER,
      subjectId: userId,
      actorId: query.actor,
      event: query.event,
      outcome: query.outcome,
      occurredFrom: query.occurredFrom,
      occurredTo: query.occurredTo,
      page: query.page,
      take: query.take,
    });
    const data = result.data.map((event) => new UserActivityEventDto(event));
    return new UserActivityPageDto(data, result.meta);
  }
}
