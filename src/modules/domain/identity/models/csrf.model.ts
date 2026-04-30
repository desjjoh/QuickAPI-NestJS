interface ICSRF {
  token: string;
  iat: number;
  exp: number;
}

export class CsrfDto {
  public readonly token: string;
  public readonly iat: number;
  public readonly exp: number;

  constructor({ token, iat, exp }: ICSRF) {
    this.token = token;
    this.iat = iat;
    this.exp = exp;
  }
}
