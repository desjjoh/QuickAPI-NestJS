import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsOptional } from 'class-validator';

import { PaginationOptions } from '@/common/models/pagination.model';
import { BaseModel } from '@/common/models/base.model';
import { AddressDto } from '@/common/models/address.model';

import { UserEntity } from '../entities/user.entity';
import { ImageDto } from '../../library/models/image.model';
import { RoleDto } from '../../library/models/role.model';
import { RoleEntity } from '../../library/entities/role.entity';

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

  @ApiPropertyOptional({
    example: '+16135550123',
    description:
      'Primary phone number for the user in E.164 format, when provided.',
    nullable: true,
  })
  public readonly phone_e164: string | null;

  public constructor(user: UserEntity) {
    this.email = user.identity.email;
    this.phone_e164 = user.identity.phone_e164 ?? null;
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
  @ApiProperty({
    example: '1990-01-15',
    description: 'The user’s date of birth in ISO date format.',
  })
  public readonly dob: string;

  @ApiProperty({
    example: 'male',
    description:
      'Stable gender key selected from the configured gender reference data.',
  })
  public readonly gender: string;

  public constructor(user: UserEntity) {
    this.dob = user.profile.personal.dob;
    this.gender = user.profile.personal.gender.key;
  }
}

export class ContactDto {
  @ApiPropertyOptional({
    example: '+16135550999',
    description:
      'Alternate phone number for the user in E.164 format, when provided.',
    nullable: true,
  })
  public readonly alternate_phone_e164: string | null;

  @ApiPropertyOptional({
    type: AddressDto,
    description: 'Optional mailing or contact address for the user.',
    nullable: true,
  })
  public readonly address: AddressDto | null;

  public constructor(user: UserEntity) {
    this.alternate_phone_e164 =
      user.profile.contact.alternate_phone_e164 ?? null;

    this.address = user.profile.contact.address
      ? new AddressDto(user.profile.contact.address)
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

  @ApiPropertyOptional({
    type: ImageDto,
    description: 'Optional avatar image associated with the user profile.',
    nullable: true,
  })
  public readonly avatar: ImageDto | null;

  public constructor(user: UserEntity) {
    this.name = new NameDto(user);
    this.personal = new PersonalDto(user);
    this.contact = new ContactDto(user);
    this.avatar = user.profile.avatar
      ? new ImageDto(user.profile.avatar)
      : null;
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
    example: [RoleDto],
    description:
      'Roles assigned to the user, including the permissions granted by each role.',
  })
  public readonly roles: RoleDto[];

  public constructor(user: UserEntity) {
    super(user);

    this.identity = new IdentityDto(user);
    this.profile = new ProfileDto(user);
    this.roles = user.roles?.map((role: RoleEntity) => new RoleDto(role)) ?? [];
  }
}
