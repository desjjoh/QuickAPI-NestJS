import { JwtSignOptions } from '@nestjs/jwt';

export type JwtPayload = {
  sub: string;
  email: string;
};

export type RefreshPayload = JwtPayload & {
  version: number;
};

export type TokenServiceOptions = {
  jwtSecret: string;
  jwtExpiryTime: JwtSignOptions['expiresIn'];
  refreshSecret: string;
  refreshExpiryTime: JwtSignOptions['expiresIn'];
  cryptoSecret: string;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
};

export type DecodedToken = JwtPayload & {
  iat: number;
  exp: number;
};
