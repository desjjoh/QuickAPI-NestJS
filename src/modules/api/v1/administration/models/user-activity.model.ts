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
import type { AuditEvent } from '@/modules/domain/audit/models/audit-query-result.model';
import { AccountActivityOutcome } from '../../account/models/activity.model';
import { PaginationMeta } from '@/common/models/pagination.model';
import {
  AuditActorType,
  AuditResourceType,
  AuditSubjectType,
} from '@/config/audit-events.config';

export class UserActivityQueryDto {
  @ApiPropertyOptional({ description: 'Exact actor ID.', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public readonly actor?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  public readonly event?: string;

  @ApiPropertyOptional({ enum: AccountActivityOutcome })
  @IsOptional()
  @IsEnum(AccountActivityOutcome)
  public readonly outcome?: AccountActivityOutcome;

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

export class UserActivityEventDto {
  @ApiProperty() public readonly id: string;
  @ApiProperty() public readonly domain: string;
  @ApiProperty() public readonly event: string;
  @ApiProperty({ enum: AccountActivityOutcome })
  public readonly outcome: string;
  @ApiProperty({ enum: AuditActorType })
  public readonly actorType: AuditActorType;
  @ApiProperty({ nullable: true }) public readonly actorId: string | null;
  @ApiProperty({ enum: AuditSubjectType, nullable: true })
  public readonly subjectType: AuditSubjectType | null;
  @ApiProperty({ nullable: true }) public readonly subjectId: string | null;
  @ApiProperty({ enum: AuditResourceType, nullable: true })
  public readonly resourceType: AuditResourceType | null;
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
    this.occurredAt = event.occurredAt;
  }
}

export class UserActivityPageDto {
  @ApiProperty({ type: UserActivityEventDto, isArray: true })
  public readonly data: UserActivityEventDto[];
  @ApiProperty({ type: PaginationMeta })
  public readonly meta: PaginationMeta;

  public constructor(data: UserActivityEventDto[], meta: PaginationMeta) {
    this.data = data;
    this.meta = meta;
  }
}
