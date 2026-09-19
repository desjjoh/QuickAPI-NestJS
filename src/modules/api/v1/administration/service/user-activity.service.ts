import { AuditSubjectType } from '@/config/audit-events.config';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import { IpLocationService } from '@/modules/system/geolocation/services/ip-location.service';
import {
  AuditEventDto,
  AuditEventPageDto,
  UserActivitySearchQueryDto,
} from '@/common/models/audit.model';

@Injectable()
export class UserActivityAdminService {
  public constructor(
    private readonly auditQueries: AuditQueryService,
    private readonly ipLocations: IpLocationService,
  ) {}

  public async findForUser(
    userId: string,
    query: UserActivitySearchQueryDto,
  ): Promise<AuditEventPageDto> {
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
    const data = await Promise.all(
      result.data.map(async (event) => {
        const location = await this.ipLocations.resolveIp(event.ipAddress);
        return new AuditEventDto(event, location);
      }),
    );
    return new AuditEventPageDto(data, result.meta);
  }
}
