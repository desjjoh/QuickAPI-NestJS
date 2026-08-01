import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import {
  AuditDetailDto,
  AuditSearchPageDto,
  AuditSearchQueryDto,
  AuditSummaryDto,
} from '../models/audit.model';

@Injectable()
export class AuditAdministrationService {
  public constructor(private readonly queries: AuditQueryService) {}

  public async search(query: AuditSearchQueryDto): Promise<AuditSearchPageDto> {
    const result = await this.queries.query(query);
    return new AuditSearchPageDto(
      result.data.map((event) => new AuditSummaryDto(event)),
      result.meta,
    );
  }

  public async detail(id: string): Promise<AuditDetailDto> {
    const event = await this.queries.findById(id);
    if (!event) throw new NotFoundException('Audit event not found.');
    return new AuditDetailDto(event);
  }
}
