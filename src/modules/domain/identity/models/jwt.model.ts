import { ApiProperty } from '@nestjs/swagger';
import { tokenParams } from '../types/jwt.types';
import { UserDto } from './user.model';

export class JWTDto {
  @ApiProperty({
    description:
      'Expiration timestamp for refresh cookie (seconds since Unix epoch).',
    example: 1688213427,
  })
  public readonly refresh: number;

  @ApiProperty({
    description: 'The signed JWT access token string.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  public readonly access_token: string;

  @ApiProperty({
    description: 'Issued At timestamp (seconds since Unix epoch).',
    example: 1688209827,
  })
  public readonly iat: number;

  @ApiProperty({
    description: 'Expiration timestamp (seconds since Unix epoch).',
    example: 1688213427,
  })
  public readonly exp: number;

  @ApiProperty({
    description: 'The user entity associated with this token.',
    type: UserDto,
  })
  public readonly user: UserDto;

  constructor({ access_token, iat, exp, user, refresh }: tokenParams) {
    this.refresh = refresh;
    this.access_token = access_token;
    this.iat = iat;
    this.exp = exp;
    this.user = new UserDto(user);
  }
}
