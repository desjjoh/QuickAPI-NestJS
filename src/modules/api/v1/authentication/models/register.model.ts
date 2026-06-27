import { Base } from '@/common/models/base.model';
import { RegistrationTokenMetadata } from '@/modules/domain/identity/entities/registration-token.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DeepPartial } from 'typeorm';

export class RegisterDto {
  @ApiProperty({
    example: 'example@domain.com',
    description: 'The email address used to register and sign in.',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  public readonly email!: string;

  @ApiProperty({
    example: 'NJccb2-OaJ0{bs;-',
    description:
      'Password must be 8 to 16 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character.',
    minLength: 8,
    maxLength: 16,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(16)
  @Matches(/\d/, {
    message: 'Password must include at least one number.',
  })
  @Matches(/[a-z]/, {
    message: 'Password must include at least one lowercase letter.',
  })
  @Matches(/[A-Z]/, {
    message: 'Password must include at least one uppercase letter.',
  })
  @Matches(/[^\w\s]/, {
    message: 'Password must include at least one special character.',
  })
  public readonly password!: string;

  @ApiProperty({
    example: 'Jane',
    description: 'The user’s legal or given first name.',
  })
  @IsString()
  @MaxLength(100)
  public readonly first_name!: string;

  @ApiProperty({
    example: 'Doe',
    description: 'The user’s legal or family last name.',
  })
  @IsString()
  @MaxLength(100)
  public readonly last_name!: string;

  @ApiProperty({
    example: '1990-01-15',
    description: 'The user’s date of birth in ISO date format.',
  })
  @IsDateString()
  public readonly dob!: string;

  @ApiProperty({
    example: 'SUwDyXR7iSBnyWmr',
    description: 'The unique NanoID of the selected gender reference record.',
    minLength: 16,
    maxLength: 16,
    pattern: '^[0-9A-Za-z]{16}$',
  })
  @IsString()
  @IsNotEmpty()
  @Length(16, 16)
  @Matches(/^[0-9A-Za-z]{16}$/, {
    message: 'Gender ID must contain only letters and numbers.',
  })
  public readonly gender_id!: string;

  @ApiProperty({
    example: 'SUwDyXR7iSBnyWmr',
    description: 'The unique NanoID of the selected country reference record.',
    minLength: 16,
    maxLength: 16,
    pattern: '^[0-9A-Za-z]{16}$',
  })
  @IsString()
  @IsNotEmpty()
  @Length(16, 16)
  @Matches(/^[0-9A-Za-z]{16}$/, {
    message: 'Country ID must contain only letters and numbers.',
  })
  public readonly country_id!: string;

  @ApiProperty({
    example: 'America/Toronto',
    description:
      'Stable IANA time zone key selected from the configured time zone reference data.',
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  public readonly timezone_id!: string;
}

export class RegisterMapper {
  public static toCreateUserInput(
    dto: RegisterDto,
    password: string,
  ): DeepPartial<Base<UserEntity>> {
    return {
      identity: {
        email: dto.email,
        password,
      },
      profile: {
        name: {
          first: dto.first_name,
          last: dto.last_name,
          preferred: null,
        },
        personal: {
          bio: null,
          dob: dto.dob,
          gender: { id: dto.gender_id },
        },
        region: {
          country: { id: dto.country_id },
          timezone: { id: dto.timezone_id },
        },
      },
    };
  }

  public static toRegistrationTokenMetadata(
    dto: RegisterDto,
    password: string,
  ): RegistrationTokenMetadata {
    return {
      email: dto.email,
      password,
      profile: {
        name: {
          first: dto.first_name,
          last: dto.last_name,
          preferred: null,
        },
        personal: {
          bio: null,
          dob: dto.dob,
          gender: { id: dto.gender_id },
        },
        region: {
          country: { id: dto.country_id },
          timezone: { id: dto.timezone_id },
        },
      },
      credentials: {
        refresh: null,
        token_version: 0,
      },
    };
  }
}

export class RegistrationPendingDto {
  @ApiProperty({
    example: 'Registration pending. Please verify your email address.',
    description: 'Human-readable registration result message.',
  })
  public readonly message: string;

  @ApiProperty({
    example: 'jane.doe@example.com',
    description: 'The email address that must be verified.',
  })
  public readonly email: string;

  public constructor(data: RegistrationPendingDto) {
    this.message = data.message;
    this.email = data.email;
  }
}

export class ResendRegistrationDto {
  @ApiProperty({
    example: 'example@domain.com',
    description: 'The email address for the pending registration to resend.',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  public readonly email!: string;
}

export class ValidateRegistrationTokenDto {
  @ApiProperty({
    example: 'A9x4bW8rN2Yp7sQmL6zT0cF3vH1jK5uDqE8iRoP',
    description:
      'The raw one-time registration token sent to the user. The API hashes this value before comparison.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly token!: string;
}

export class VerifyRegistrationDto extends ValidateRegistrationTokenDto {
  @ApiProperty({
    example: '123456',
    description:
      'The 6-digit verification code included in the registration email.',
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d{6}$',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'Verification code must be exactly 6 digits.',
  })
  public readonly code!: string;
}

export class ValidateRegistrationTokenResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Indicates the registration token exists, has not expired, has not been consumed, and matches the provided token value.',
  })
  public readonly valid: boolean;

  public constructor(data: ValidateRegistrationTokenResponseDto) {
    this.valid = data.valid;
  }
}

export class VerifyRegistrationResponseDto {
  @ApiProperty({
    example: 'Registration verified successfully.',
    description: 'Human-readable confirmation message.',
  })
  public readonly message: string;

  public constructor(data: VerifyRegistrationResponseDto) {
    this.message = data.message;
  }
}
