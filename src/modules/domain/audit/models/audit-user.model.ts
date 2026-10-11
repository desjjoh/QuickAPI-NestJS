import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { ImageDto } from '@/modules/domain/media/models/image.model';

/** Explicit persistence projection; never hydrate a complete identity for audits. */
export interface AuditUserRead {
  readonly id: string;
  readonly email: string;
  readonly first: string;
  readonly last: string;
  readonly preferred: string | null;
  readonly status_key: string;
  readonly status_label: string;
  readonly avatar_id: string | null;
  readonly avatar_key: string | null;
}

export class AuditUserStatusDto {
  @ApiProperty({
    description: 'Authoritative account status key.',
    example: 'deleted',
  })
  public readonly key: string;
  @ApiProperty({ example: 'Deleted' })
  public readonly label: string;

  public constructor(user: AuditUserRead) {
    this.key = user.status_key;
    this.label = user.status_label;
    Object.freeze(this);
  }
}

export class AuditUserAvatarDto {
  @ApiProperty()
  public readonly id: string;
  @ApiProperty({ description: 'Public avatar display URL.' })
  public readonly url: string;

  public constructor(id: string, storageKey: string) {
    this.id = id;
    this.url = ImageDto.buildPublicUrl(storageKey);
    Object.freeze(this);
  }
}

/** The shared allowlisted user representation for administration audit views. */
export class AuditUserDto {
  @ApiProperty()
  public readonly id: string;
  @ApiProperty({
    description: 'Current preferred name, falling back to full name.',
  })
  public readonly name: string;
  @ApiProperty({
    type: String,
    description:
      'Current email, including the internal UUID address for a deleted account. Historical snapshot emails remain redacted.',
  })
  public readonly email: string;
  @ApiPropertyOptional({ type: AuditUserAvatarDto, nullable: true })
  public readonly avatar: AuditUserAvatarDto | null;
  @ApiProperty({ type: AuditUserStatusDto })
  public readonly status: AuditUserStatusDto;

  public constructor(user: AuditUserRead) {
    const deleted = user.status_key === ACCOUNT_STATUS_KEYS.DELETED;
    this.id = user.id;
    this.name =
      user.preferred?.trim() ||
      [user.first, user.last].filter(Boolean).join(' ');
    this.email = user.email;
    this.avatar =
      !deleted && user.avatar_id && user.avatar_key
        ? new AuditUserAvatarDto(user.avatar_id, user.avatar_key)
        : null;
    this.status = new AuditUserStatusDto(user);
    Object.freeze(this);
  }
}
