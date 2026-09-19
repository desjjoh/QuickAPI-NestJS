import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditSubjectType } from '@/config/audit-events.config';
import { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { IpLocationService } from '@/modules/system/geolocation/services/ip-location.service';
import {
  AuditEventDto,
  AuditEventPageDto,
  AccountActivitySearchQueryDto,
} from '@/common/models/audit.model';

@Injectable()
export class ActivityApiService {
  public constructor(
    private readonly auditQueries: AuditQueryService,
    private readonly ipLocations: IpLocationService,
  ) {}

  public async findForUser(
    user: UserEntity,
    query: AccountActivitySearchQueryDto,
  ): Promise<AuditEventPageDto> {
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
    const data = await Promise.all(
      result.data.map(async (event) => {
        const location = await this.ipLocations.resolveIp(event.ipAddress);
        return new AuditEventDto(event, location);
      }),
    );
    return new AuditEventPageDto(data, result.meta);
  }
}
