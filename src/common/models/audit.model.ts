import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
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
import {
  getBrowser,
  getBrowserVersion,
  getDevice,
  getOs,
  getOsVersion,
} from '@/common/helpers/session-info.helper';
import { PaginationMeta } from '@/common/models/pagination.model';
import {
  ADMINISTRATION_REASON_CODES,
  AdministrationReasonCode,
} from '@/config/administration.config';
import {
  AuditActorType,
  AuditResourceType,
  AuditSubjectType,
} from '@/config/audit-events.config';
import type { SessionIpLocation } from '@/modules/system/geolocation/services/ip-location.service';
import { AuditEvent } from '@/modules/domain/audit/models/audit-query-result.model';

type AuditData = Readonly<Record<string, unknown>>;

const administrationReasonCodes = new Set<string>(
  Object.values(ADMINISTRATION_REASON_CODES),
);

export class AuditIpLocationDto {
  @ApiPropertyOptional({
    example: '203.0.113.10',
    description: 'IP address used for the geolocation lookup.',
    nullable: true,
  })
  public readonly ip: string | null;
  @ApiPropertyOptional({
    example: 'CA',
    description: 'ISO 3166-1 alpha-2 country code resolved from the IP.',
    nullable: true,
  })
  public readonly countryCode: string | null;
  @ApiPropertyOptional({
    example: 'Canada',
    description: 'Country name resolved from the IP.',
    nullable: true,
  })
  public readonly countryName: string | null;
  @ApiPropertyOptional({
    example: 'ON',
    description: 'Subdivision or region code resolved from the IP.',
    nullable: true,
  })
  public readonly regionCode: string | null;
  @ApiPropertyOptional({
    example: 'Ontario',
    description: 'Subdivision or region name resolved from the IP.',
    nullable: true,
  })
  public readonly regionName: string | null;
  @ApiPropertyOptional({
    example: 'Ottawa',
    description: 'City resolved from the IP.',
    nullable: true,
  })
  public readonly city: string | null;
  @ApiProperty({
    enum: ['maxmind', 'unknown'],
    example: 'maxmind',
    description:
      'Provider that resolved the location, or unknown when unavailable.',
  })
  public readonly source: 'maxmind' | 'unknown';
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-19T14:32:11.123Z',
    description: 'Time at which this geolocation lookup was performed.',
  })
  public readonly resolvedAt: Date;

  public constructor(location: SessionIpLocation) {
    this.ip = location.ip;
    this.countryCode = location.countryCode;
    this.countryName = location.countryName;
    this.regionCode = location.regionCode;
    this.regionName = location.regionName;
    this.city = location.city;
    this.source = location.source;
    this.resolvedAt = new Date(location.resolvedAt);
  }
}

/** The single API representation of a complete, redacted audit event. */
export class AuditEventDto {
  @ApiProperty({
    example: 'A1b2C3d4E5f6G7h8',
    description: 'Unique 16-character identifier for the audit event.',
  })
  public readonly id: string;
  @ApiProperty({
    example: 'identity',
    description: 'Application domain that emitted the event.',
  })
  public readonly domain: string;
  @ApiProperty({
    example: 'user.updated',
    description: 'Stable machine-readable event name.',
  })
  public readonly event: string;
  @ApiProperty({
    enum: AuditActorType,
    example: AuditActorType.USER,
    description: 'Category of actor that initiated the operation.',
  })
  public readonly actorType: AuditActorType;
  @ApiPropertyOptional({
    example: 'U1s2e3r4A5c6t7o8',
    description: 'Identifier of the actor, when the actor is identifiable.',
    nullable: true,
  })
  public readonly actorId: string | null;
  @ApiPropertyOptional({
    enum: AuditSubjectType,
    example: AuditSubjectType.USER,
    description: 'Category of entity affected by the operation.',
    nullable: true,
  })
  public readonly subjectType: AuditSubjectType | null;
  @ApiPropertyOptional({
    example: 'S1u2b3j4e5c6t7I8',
    description: 'Identifier of the entity affected by the operation.',
    nullable: true,
  })
  public readonly subjectId: string | null;
  @ApiPropertyOptional({
    enum: AuditResourceType,
    example: AuditResourceType.IDENTITY_USER,
    description: 'Category of resource on which the operation acted.',
    nullable: true,
  })
  public readonly resourceType: AuditResourceType | null;
  @ApiPropertyOptional({
    example: 'R1e2s3o4u5r6c7e8',
    description: 'Identifier of the resource on which the operation acted.',
    nullable: true,
  })
  public readonly resourceId: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-19T14:30:00.000Z',
    description: 'Time at which the audited action occurred.',
  })
  public readonly occurredAt: Date;
  @ApiPropertyOptional({
    example: 'profile-update-U1s2e3r4',
    description: 'Identifier correlating events from one logical operation.',
    nullable: true,
  })
  public readonly operationId: string | null;
  @ApiPropertyOptional({
    example: 'req-01J8Y7K6M5N4P3Q2',
    description: 'Identifier correlating the event with an HTTP request.',
    nullable: true,
  })
  public readonly requestId: string | null;
  @ApiPropertyOptional({
    example: 'S3s4s5i6o7n8I9d0',
    description:
      'Identifier of the authenticated session associated with the event.',
    nullable: true,
  })
  public readonly sessionId: string | null;
  @ApiPropertyOptional({
    example: '203.0.113.10',
    description: 'Network address captured for the audited action.',
    nullable: true,
  })
  public readonly ipAddress: string | null;
  @ApiProperty({
    type: AuditIpLocationDto,
    description: 'Best-effort geolocation of the captured IP address.',
  })
  public readonly ipLocation: AuditIpLocationDto;
  @ApiPropertyOptional({
    example: 'Mozilla/5.0 (...) Chrome/126.0.0.0 Safari/537.36',
    description: 'Raw user-agent captured for the audited action.',
    nullable: true,
  })
  public readonly userAgent: string | null;
  @ApiPropertyOptional({
    example: 'Chrome',
    description: 'Browser parsed from the captured user-agent.',
    nullable: true,
  })
  public readonly browser: string | null;
  @ApiPropertyOptional({
    example: '126.0.0.0',
    description: 'Browser version parsed from the captured user-agent.',
    nullable: true,
  })
  public readonly browserVersion: string | null;
  @ApiPropertyOptional({
    example: 'Desktop',
    description: 'Device class parsed from the captured user-agent.',
    nullable: true,
  })
  public readonly device: string | null;
  @ApiPropertyOptional({
    example: 'macOS',
    description: 'Operating system parsed from the captured user-agent.',
    nullable: true,
  })
  public readonly os: string | null;
  @ApiPropertyOptional({
    example: '14.2.1',
    description:
      'Operating-system version parsed from the captured user-agent.',
    nullable: true,
  })
  public readonly osVersion: string | null;
  @ApiPropertyOptional({
    example: 'PATCH',
    description: 'HTTP method associated with the audited request.',
    nullable: true,
  })
  public readonly httpMethod: string | null;
  @ApiPropertyOptional({
    example: '/api/v1/account/profile',
    description: 'Matched API route associated with the audited request.',
    nullable: true,
  })
  public readonly route: string | null;
  @ApiProperty({
    example: 'http',
    description: 'Channel or subsystem from which the audit event originated.',
  })
  public readonly source: string;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { display_name: 'Previous name' },
    description: 'Redacted values before the audited change.',
    nullable: true,
  })
  public readonly before: AuditData | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { display_name: 'Updated name' },
    description: 'Redacted values after the audited change.',
    nullable: true,
  })
  public readonly after: AuditData | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { display_name: true },
    description: 'Redacted field-level diff for the audited change.',
    nullable: true,
  })
  public readonly changes: AuditData | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { reason_code: 'policy_enforcement' },
    description: 'Redacted structured context supplied by the event producer.',
    nullable: true,
  })
  public readonly metadata: AuditData | null;
  @ApiPropertyOptional({
    enum: ADMINISTRATION_REASON_CODES,
    example: 'policy_enforcement',
    nullable: true,
    description: 'Validated reason code for an administration action.',
  })
  public readonly reasonCode: AdministrationReasonCode | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-19T14:30:00.100Z',
    description: 'Time at which the audit record was persisted.',
  })
  public readonly createdAt: Date;
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-19T14:30:00.100Z',
    description: 'Time at which the persisted audit record was last updated.',
  })
  public readonly updatedAt: Date;

  public constructor(event: AuditEvent, location: SessionIpLocation) {
    this.id = event.id;
    this.domain = event.domain;
    this.event = event.event;
    this.actorType = event.actorType;
    this.actorId = event.actorId;
    this.subjectType = event.subjectType;
    this.subjectId = event.subjectId;
    this.resourceType = event.resourceType;
    this.resourceId = event.resourceId;
    this.occurredAt = new Date(event.occurredAt);
    this.operationId = event.operationId;
    this.requestId = event.requestId;
    this.sessionId = event.sessionId;
    this.ipAddress = event.ipAddress;
    this.ipLocation = new AuditIpLocationDto(location);
    this.userAgent = event.userAgent;
    this.browser = getBrowser(event.userAgent);
    this.browserVersion = getBrowserVersion(event.userAgent);
    this.device = getDevice(event.userAgent);
    this.os = getOs(event.userAgent);
    this.osVersion = getOsVersion(event.userAgent);
    this.httpMethod = event.httpMethod;
    this.route = event.route;
    this.source = event.source;
    this.before = event.before;
    this.after = event.after;
    this.changes = event.changes;
    this.metadata = event.metadata;
    const reasonCode = event.metadata?.reason_code;
    this.reasonCode =
      typeof reasonCode === 'string' &&
      administrationReasonCodes.has(reasonCode)
        ? (reasonCode as AdministrationReasonCode)
        : null;
    this.createdAt = new Date(event.createdAt);
    this.updatedAt = new Date(event.updatedAt);
  }
}

export class AuditEventPageDto {
  @ApiProperty({
    type: AuditEventDto,
    isArray: true,
    description: 'Complete redacted audit events for the requested page.',
  })
  public readonly data: AuditEventDto[];
  @ApiProperty({
    type: PaginationMeta,
    description: 'Pagination details for the audit-event result set.',
  })
  public readonly meta: PaginationMeta;

  public constructor(data: AuditEventDto[], meta: PaginationMeta) {
    this.data = data;
    this.meta = meta;
  }
}

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

export class AccountActivitySearchQueryDto extends OmitType(
  AuditSearchQueryDto,
  ['actorType', 'actorId'] as const,
) {}

export class UserActivitySearchQueryDto extends OmitType(AuditSearchQueryDto, [
  'domain',
  'actorType',
  'actorId',
] as const) {
  @ApiPropertyOptional({ description: 'Exact actor ID.', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public readonly actor?: string;
}
