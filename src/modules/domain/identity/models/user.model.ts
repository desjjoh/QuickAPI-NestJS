import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsOptional } from 'class-validator';

import { PaginationOptions } from '@/common/models/pagination.model';
import { BaseModel } from '@/common/models/base.model';
import { AddressDto } from '@/common/models/address.model';

import { UserSessionEntity } from '../entities/session.entity';
import { UserEntity, createUserMetadata } from '../entities/user.entity';
import { RoleDto } from '../../library/models/role.model';
import { RoleEntity } from '../../library/entities/role.entity';
import { ImageDto } from '../../media/models/image.model';
import { PhoneDto } from '@/common/models/phone.model';
import { BaseCountryDto } from '../../library/models/country.model';
import { BaseTimezoneDto } from '../../library/models/time-zone.model';
import { AccountStatusDto } from '../../library/models/status.model';
import { GenderDto } from '../../library/models/gender.model';

enum SORT_OPTIONS {
  CREATED = 'user.createdAt',
  LAST_NAME = 'profile.name.last',
  EMAIL = 'user.identity.email',
  NAME = 'fullname',
}

export class UserPaginationOptions extends PaginationOptions {
  @ApiPropertyOptional({
    description: 'Sort order for the users list. Defaults to `CREATED`.',
    enum: SORT_OPTIONS,
    default: SORT_OPTIONS.CREATED,
    example: SORT_OPTIONS.CREATED,
  })
  @IsEnum(SORT_OPTIONS)
  @IsOptional()
  public readonly sort: SORT_OPTIONS = SORT_OPTIONS.CREATED;
}

export class IdentityDto {
  @ApiProperty({
    example: 'chuck.tester@example.com',
    description:
      'The email address used to identify and sign in to the account.',
  })
  public readonly email: string;

  public constructor(user: UserEntity) {
    this.email = user.identity.email;
  }
}

export class NameDto {
  @ApiProperty({
    example: 'Chuck',
    description: 'The user’s given or legal first name.',
  })
  public readonly first: string;

  @ApiProperty({
    example: 'Tester',
    description: 'The user’s family or legal last name.',
  })
  public readonly last: string;

  @ApiPropertyOptional({
    example: 'Chuck',
    description:
      'Optional preferred name used for display when different from the legal first name.',
    nullable: true,
  })
  public readonly preferred: string | null;

  public constructor(user: UserEntity) {
    this.first = user.profile.name.first;
    this.last = user.profile.name.last;
    this.preferred = user.profile.name.preferred ?? null;
  }
}

export class PersonalDto {
  @ApiPropertyOptional({
    example: 'Builder, tester, and lifelong API tinkerer.',
    description: 'Plain-text profile bio.',
    nullable: true,
    maxLength: 255,
  })
  public readonly bio: string | null;

  @ApiProperty({
    example: '1990-01-15',
    description: 'The user’s date of birth in ISO date format.',
  })
  public readonly dob: string;

  @ApiProperty({
    type: GenderDto,
    description: 'Selected gender from the configured gender reference data.',
  })
  public readonly gender: GenderDto;

  public constructor(user: UserEntity) {
    this.bio = user.profile.personal.bio ?? null;
    this.dob = user.profile.personal.dob;
    this.gender = new GenderDto(user.profile.personal.gender);
  }
}

export class ContactDto {
  @ApiPropertyOptional({
    type: PhoneDto,
    description: 'Primary phone number details for the user, when provided.',
    nullable: true,
  })
  public readonly phone: PhoneDto | null;

  @ApiPropertyOptional({
    type: AddressDto,
    description: 'Optional mailing or contact address for the user.',
    nullable: true,
  })
  public readonly address: AddressDto | null;

  public constructor(user: UserEntity) {
    this.phone = user.profile.contact.phone
      ? new PhoneDto(user.profile.contact.phone)
      : null;

    this.address = user.profile.contact.address
      ? new AddressDto(user.profile.contact.address)
      : null;
  }
}

export class RegionDto {
  @ApiProperty({
    type: BaseCountryDto,
    description: 'Country associated with the user profile region.',
  })
  public readonly country: BaseCountryDto;

  @ApiProperty({
    type: BaseTimezoneDto,
    description: 'Time zone associated with the user profile region.',
  })
  public readonly timezone: BaseTimezoneDto;

  public constructor(user: UserEntity) {
    this.country = new BaseCountryDto(user.profile.region.country);
    this.timezone = new BaseTimezoneDto(user.profile.region.timezone);
  }
}

export class MediaDto {
  @ApiPropertyOptional({
    type: ImageDto,
    description: 'Optional avatar image associated with the user profile.',
    nullable: true,
  })
  public readonly avatar: ImageDto | null;

  public constructor(user: UserEntity) {
    this.avatar = user.profile.media.avatar
      ? new ImageDto(user.profile.media.avatar)
      : null;
  }
}

export class ProfileDto {
  @ApiProperty({
    type: NameDto,
    description: 'Name information associated with the user profile.',
  })
  public readonly name: NameDto;

  @ApiProperty({
    type: PersonalDto,
    description: 'Personal information associated with the user profile.',
  })
  public readonly personal: PersonalDto;

  @ApiProperty({
    type: ContactDto,
    description: 'Contact information associated with the user profile.',
  })
  public readonly contact: ContactDto;

  @ApiProperty({
    type: RegionDto,
    description:
      'Regional country information associated with the user profile.',
  })
  public readonly region: RegionDto;

  @ApiProperty({
    type: MediaDto,
    description: 'Images and media associated with the user account.',
  })
  public readonly media: MediaDto;

  public constructor(user: UserEntity) {
    this.name = new NameDto(user);
    this.personal = new PersonalDto(user);
    this.contact = new ContactDto(user);
    this.region = new RegionDto(user);
    this.media = new MediaDto(user);
  }
}

export class MetadataDto {
  @ApiProperty({
    example: false,
    description: 'Whether sign-in multi-factor authentication is enabled.',
  })
  public readonly mfaEnabled: boolean;

  @ApiPropertyOptional({
    example: '2026-06-25T14:30:00.000Z',
    description:
      'Most recent successful sign-in timestamp, in ISO 8601 format.',
    nullable: true,
  })
  public readonly lastSignIn: string | null;

  @ApiPropertyOptional({
    example: '2026-06-25T14:30:00.000Z',
    description:
      'Most recent confirmed email change timestamp, in ISO 8601 format.',
    nullable: true,
  })
  public readonly lastChangedEmail: string | null;

  @ApiPropertyOptional({
    example: '2026-06-25T14:30:00.000Z',
    description: 'Most recent password change timestamp, in ISO 8601 format.',
    nullable: true,
  })
  public readonly lastChangedPassword: string | null;

  @ApiPropertyOptional({
    example: '2026-06-25T14:30:00.000Z',
    description:
      'Most recent user account or profile mutation timestamp, in ISO 8601 format.',
    nullable: true,
  })
  public readonly lastUpdatedAt: string | null;

  public constructor(user: UserEntity) {
    const metadata = createUserMetadata(user.metadata);

    this.lastSignIn = metadata.last_sign_in?.toISOString() ?? null;
    this.lastChangedEmail = metadata.last_changed_email?.toISOString() ?? null;
    this.lastChangedPassword =
      metadata.last_changed_password?.toISOString() ?? null;
    this.lastUpdatedAt = metadata.last_updated_at?.toISOString() ?? null;
    this.mfaEnabled = metadata.mfa_enabled ?? false;
  }
}

export class SessionDto extends BaseModel {
  @ApiProperty({
    example: true,
    description:
      'Whether the session is still active and can authenticate requests.',
  })
  public readonly active: boolean;

  @ApiPropertyOptional({
    example: 'Chrome',
    description: 'Browser associated with the current stored session.',
    nullable: true,
  })
  public readonly browser: string | null;

  @ApiPropertyOptional({
    example: '120.0.0.0',
    description: 'Browser version associated with the current stored session.',
    nullable: true,
  })
  public readonly browserVersion: string | null;

  @ApiPropertyOptional({
    example: 'Desktop',
    description: 'Device class associated with the current stored session.',
    nullable: true,
  })
  public readonly device: string | null;

  @ApiPropertyOptional({
    example: 'macOS',
    description: 'Operating system associated with the current stored session.',
    nullable: true,
  })
  public readonly os: string | null;

  @ApiPropertyOptional({
    example: '14.2.1',
    description:
      'Operating system version associated with the current stored session.',
    nullable: true,
  })
  public readonly osVersion: string | null;

  @ApiPropertyOptional({
    example: '203.0.113.10',
    description: 'IP address associated with the current stored session.',
    nullable: true,
  })
  public readonly ipAddress: string | null;

  @ApiPropertyOptional({
    example: 'CA',
    description:
      'GeoLite2 country ISO 3166-1 alpha-2 code for the stored session.',
    nullable: true,
  })
  public readonly countryCode: string | null;

  @ApiPropertyOptional({
    example: 'Canada',
    description: 'GeoLite2 country name for the stored session.',
    nullable: true,
  })
  public readonly countryName: string | null;

  @ApiPropertyOptional({
    example: 'ON',
    description: 'GeoLite2 subdivision/region code for the stored session.',
    nullable: true,
  })
  public readonly regionCode: string | null;

  @ApiPropertyOptional({
    example: 'Ontario',
    description: 'GeoLite2 subdivision/region name for the stored session.',
    nullable: true,
  })
  public readonly regionName: string | null;

  @ApiPropertyOptional({
    example: 'Ottawa',
    description: 'GeoLite2 city for the stored session.',
    nullable: true,
  })
  public readonly city: string | null;

  @ApiPropertyOptional({
    example: 'maxmind',
    description: 'Source used to resolve the stored session location.',
    nullable: true,
  })
  public readonly locationSource: string | null;

  @ApiPropertyOptional({
    example: '2026-07-21T12:00:00.000Z',
    description: 'Time at which the stored session location was resolved.',
    nullable: true,
  })
  public readonly locationResolvedAt: string | null;

  @ApiPropertyOptional({
    example: 'Mozilla/5.0...',
    description: 'Raw user-agent associated with the current stored session.',
    nullable: true,
  })
  public readonly userAgent: string | null;

  @ApiPropertyOptional({
    example: 'https://app.example.com',
    description: 'Origin header associated with the current stored session.',
    nullable: true,
  })
  public readonly origin: string | null;

  public constructor(session: UserSessionEntity) {
    super(session);

    this.active = session.active;
    this.browser = session.browser;
    this.browserVersion = session.browser_version;
    this.device = session.device;
    this.os = session.os;
    this.osVersion = session.os_version;
    this.ipAddress = session.ip_address;
    this.countryCode = session.location.country_code;
    this.countryName = session.location.country_name;
    this.regionCode = session.location.region_code;
    this.regionName = session.location.region_name;
    this.city = session.location.city;
    this.locationSource = session.location.source;
    this.locationResolvedAt =
      session.location.resolved_at?.toISOString() ?? null;
    this.userAgent = session.user_agent;
    this.origin = session.origin;
  }
}

export class UserDto extends BaseModel {
  @ApiProperty({
    type: IdentityDto,
    description: 'Account identity information used for contact and sign-in.',
  })
  public readonly identity: IdentityDto;

  @ApiProperty({
    type: ProfileDto,
    description: 'Profile information associated with the user account.',
  })
  public readonly profile: ProfileDto;

  @ApiProperty({
    type: MetadataDto,
    description: 'Account activity and security metadata timestamps.',
  })
  public readonly metadata: MetadataDto;

  @ApiProperty({
    example: [RoleDto],
    description:
      'Roles assigned to the user, including the permissions granted by each role.',
  })
  public readonly roles: RoleDto[];

  @ApiProperty({
    type: SessionDto,
    nullable: true,
    description:
      'Current authenticated session metadata. Full session history is available from the sessions endpoint.',
  })
  public readonly session: SessionDto | null;

  @ApiProperty({
    type: AccountStatusDto,
    description:
      'Current lifecycle status of the account, such as whether the account is active, disabled, or otherwise restricted.',
  })
  public readonly status: AccountStatusDto;

  public constructor(user: UserEntity, session?: UserSessionEntity) {
    super(user);

    this.identity = new IdentityDto(user);
    this.profile = new ProfileDto(user);
    this.roles = user.roles?.map((role: RoleEntity) => new RoleDto(role)) ?? [];
    this.metadata = new MetadataDto(user);
    this.session = session ? new SessionDto(session) : null;
    this.status = new AccountStatusDto(user.status);
  }
}
