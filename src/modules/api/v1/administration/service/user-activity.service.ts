import { AuditSubjectType } from '@/config/audit-events.config';
import { Injectable } from '@nestjs/common';
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
    const result = await this.auditQueries.query({
      subjectType: AuditSubjectType.USER,
      subjectId: userId,
      actorId: query.actor,
      event: query.event,
      occurredFrom: query.occurredFrom,
      occurredTo: query.occurredTo,
      sort: query.sort,
      order: query.order,
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
