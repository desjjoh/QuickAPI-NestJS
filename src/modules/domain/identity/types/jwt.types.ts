import { UserEntity } from '../entities/user.entity';

export interface JWTInterface {
  refresh_token: string;
  access_token: string;
}

export interface tokenParams {
  refresh: number;
  access_token: string;
  iat: number;
  exp: number;
  user: UserEntity;
}

export interface DecodedJWT {
  email: string;
  sub: string;
  iat: number;
  exp: number;
}
