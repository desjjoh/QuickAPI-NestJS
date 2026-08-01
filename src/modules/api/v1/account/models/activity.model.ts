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

export enum AccountActivityOutcome {
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  DENIED = 'denied',
  PENDING = 'pending',
  UNKNOWN = 'unknown',
}

export class AccountActivityQueryDto {
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

  @ApiPropertyOptional({
    description: 'Opaque cursor returned by a prior page.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  public readonly cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly take: number = 25;
}

/** Deliberately excludes network, client, failure, and internal metadata fields. */
export class AccountActivityEventDto {
  @ApiProperty()
  public readonly id: string;
  @ApiProperty()
  public readonly domain: string;
  @ApiProperty()
  public readonly event: string;
  @ApiProperty({ enum: AccountActivityOutcome })
  public readonly outcome: string;
  @ApiProperty({ nullable: true })
  public readonly subjectType: string | null;
  @ApiProperty({ nullable: true })
  public readonly subjectId: string | null;
  @ApiProperty({ nullable: true })
  public readonly resourceType: string | null;
  @ApiProperty({ nullable: true })
  public readonly resourceId: string | null;
  @ApiProperty({ type: String, format: 'date-time' })
  public readonly occurredAt: Date;

  public constructor(event: AuditEvent) {
    this.id = event.id;
    this.domain = event.domain;
    this.event = event.event;
    this.outcome = event.outcome;
    this.subjectType = event.subjectType;
    this.subjectId = event.subjectId;
    this.resourceType = event.resourceType;
    this.resourceId = event.resourceId;
    this.occurredAt = event.occurredAt;
  }
}

export class AccountActivityPageDto {
  @ApiProperty({ type: AccountActivityEventDto, isArray: true })
  public readonly data: AccountActivityEventDto[];
  @ApiProperty({ nullable: true, description: 'Cursor for the next page.' })
  public readonly nextCursor: string | null;

  public constructor(
    data: AccountActivityEventDto[],
    nextCursor: string | null,
  ) {
    this.data = data;
    this.nextCursor = nextCursor;
  }
}
