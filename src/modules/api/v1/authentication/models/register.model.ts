import { Base } from '@/common/models/base.model';
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
        },
        personal: {
          dob: dto.dob,
          gender: { id: dto.gender_id },
        },
      },
    };
  }
}
