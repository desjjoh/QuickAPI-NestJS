import { ApiProperty } from '@nestjs/swagger';

interface ICSRF {
  token: string;
  iat: number;
  exp: number;
}

export class CsrfDto {
  @ApiProperty({
    example: '9f3c2b1a7d4e...',
    description: 'CSRF token used to validate state-changing requests.',
  })
  public readonly token: string;

  @ApiProperty({
    example: 1714490000,
    description: 'Unix timestamp (seconds) when the CSRF token was issued.',
  })
  public readonly iat: number;

  @ApiProperty({
    example: 1714493600,
    description: 'Unix timestamp (seconds) when the CSRF token expires.',
  })
  public readonly exp: number;

  constructor({ token, iat, exp }: ICSRF) {
    this.token = token;
    this.iat = iat;
    this.exp = exp;
  }
}
