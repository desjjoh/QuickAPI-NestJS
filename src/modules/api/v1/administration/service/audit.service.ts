import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import { IpLocationService } from '@/modules/system/geolocation/services/ip-location.service';
import {
  AuditEventDto,
  AuditEventPageDto,
  AuditSearchQueryDto,
} from '@/common/models/audit.model';

@Injectable()
export class AuditAdministrationService {
  public constructor(
    private readonly queries: AuditQueryService,
    private readonly ipLocations: IpLocationService,
  ) {}

  public async search(query: AuditSearchQueryDto): Promise<AuditEventPageDto> {
    const result = await this.queries.query(query);
    const data = await Promise.all(
      result.data.map(async (event) => {
        const location = await this.ipLocations.resolveIp(event.ipAddress);
        return new AuditEventDto(event, location);
      }),
    );
    return new AuditEventPageDto(data, result.meta);
  }

  public async detail(id: string): Promise<AuditEventDto> {
    const event = await this.queries.findById(id);
    if (!event) throw new NotFoundException('Audit event not found.');
    const location = await this.ipLocations.resolveIp(event.ipAddress);
    return new AuditEventDto(event, location);
  }
}
