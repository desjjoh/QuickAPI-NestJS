import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationMeta } from '@/common/models/pagination.model';
import type { AuditEvent } from '@/modules/domain/audit/models/audit-query-result.model';
import { AccountActivityOutcome } from '../../account/models/activity.model';
import { AuditActorType } from '@/config/audit-events.config';
import {
  ADMINISTRATION_REASON_CODES,
  AdministrationReasonCode,
} from '@/config/administration.config';

type AuditDetailData = Readonly<Record<string, unknown>>;

const administrationReasonCodes = new Set<string>(
  Object.values(ADMINISTRATION_REASON_CODES),
);

export class AuditSearchQueryDto {
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  public readonly domain?: string;
  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  public readonly event?: string;
  @ApiPropertyOptional({ enum: AccountActivityOutcome })
  @IsOptional()
  @IsEnum(AccountActivityOutcome)
  public readonly outcome?: AccountActivityOutcome;
  @ApiPropertyOptional({ enum: AuditActorType })
  @IsOptional()
  @IsEnum(AuditActorType)
  public readonly actorType?: AuditActorType;
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public readonly actorId?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public readonly occurredFrom?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public readonly occurredTo?: Date;
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly page: number = 1;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly take: number = 25;
}

/** The searchable summary contract; payloads and persistence metadata never cross this boundary. */
export class AuditSummaryDto {
  @ApiProperty() public readonly id: string;
  @ApiProperty() public readonly domain: string;
  @ApiProperty() public readonly event: string;
  @ApiProperty() public readonly outcome: string;
  @ApiProperty({ enum: AuditActorType })
  public readonly actorType: AuditActorType;
  @ApiProperty({ nullable: true }) public readonly actorId: string | null;
  @ApiProperty({ nullable: true }) public readonly subjectType: string | null;
  @ApiProperty({ nullable: true }) public readonly subjectId: string | null;
  @ApiProperty({ nullable: true }) public readonly resourceType: string | null;
  @ApiProperty({ nullable: true }) public readonly resourceId: string | null;
  @ApiProperty({ type: String, format: 'date-time' })
  public readonly occurredAt: Date;

  public constructor(event: AuditEvent) {
    this.id = event.id;
    this.domain = event.domain;
    this.event = event.event;
    this.outcome = event.outcome;
    this.actorType = event.actorType;
    this.actorId = event.actorId;
    this.subjectType = event.subjectType;
    this.subjectId = event.subjectId;
    this.resourceType = event.resourceType;
    this.resourceId = event.resourceId;
    this.occurredAt = new Date(event.occurredAt);
    Object.freeze(this.occurredAt);
    if (new.target === AuditSummaryDto) Object.freeze(this);
  }
}

/** The separately authorized detail contract, containing only approved context and redacted payloads. */
export class AuditDetailDto extends AuditSummaryDto {
  @ApiProperty({
    enum: ADMINISTRATION_REASON_CODES,
    nullable: true,
    description: 'Validated reason for an administration action.',
  })
  public readonly reasonCode: AdministrationReasonCode | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  public readonly before: AuditDetailData | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  public readonly after: AuditDetailData | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  public readonly changes: AuditDetailData | null;
  @ApiProperty({ nullable: true })
  public readonly sessionId: string | null;
  @ApiProperty({ nullable: true })
  public readonly requestId: string | null;
  @ApiProperty({ nullable: true })
  public readonly httpMethod: string | null;
  @ApiProperty({ nullable: true })
  public readonly route: string | null;

  public constructor(event: AuditEvent) {
    super(event);
    const reasonCode = event.metadata?.reason_code;
    this.reasonCode =
      typeof reasonCode === 'string' &&
      administrationReasonCodes.has(reasonCode)
        ? (reasonCode as AdministrationReasonCode)
        : null;
    this.before = event.before;
    this.after = event.after;
    this.changes = event.changes;
    this.sessionId = event.sessionId;
    this.requestId = event.requestId;
    this.httpMethod = event.httpMethod;
    this.route = event.route;
    Object.freeze(this);
  }
}

export class AuditSearchPageDto {
  @ApiProperty({ type: AuditSummaryDto, isArray: true })
  public readonly data: AuditSummaryDto[];
  @ApiProperty({ type: PaginationMeta }) public readonly meta: PaginationMeta;
  public constructor(data: AuditSummaryDto[], meta: PaginationMeta) {
    this.data = data;
    this.meta = meta;
  }
}
