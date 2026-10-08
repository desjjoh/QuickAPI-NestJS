import { Injectable } from '@nestjs/common';
import { AuditActorType } from '@/config/audit-events.config';
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
    const result = await this.auditQueries.query({
      actorType: AuditActorType.USER,
      actorId: user.id,
      domain: query.domain,
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
