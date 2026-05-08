import type { CookieOptions } from 'express';
import { env } from './environment.config';
import { day, minute } from '@/common/constants/milliseconds.constants';

type SameSite = CookieOptions['sameSite'];

function getBaseCookieOptions(): CookieOptions {
  return {
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE as SameSite,
    path: env.COOKIE_PATH,
    domain: env.COOKIE_DOMAIN,
  };
}

function withoutExpiry(options: CookieOptions): CookieOptions {
  const { maxAge, expires, ...rest } = options;

  void maxAge;
  void expires;

  return rest;
}

export function getRefreshCookieName(): string {
  return env.REFRESH_COOKIE_NAME;
}

export function getRefreshCookieOptions(): CookieOptions {
  return {
    ...getBaseCookieOptions(),
    httpOnly: true,
    maxAge: env.REFRESH_COOKIE_MAX_AGE_DAYS * day,
  };
}

export function getClearRefreshCookieOptions(): CookieOptions {
  return withoutExpiry(getRefreshCookieOptions());
}

export function getCsrfCookieName(): string {
  return env.CSRF_COOKIE_NAME;
}

export function getCsrfCookieOptions(): CookieOptions {
  return {
    ...getBaseCookieOptions(),
    httpOnly: false,
    maxAge: env.CSRF_COOKIE_MAX_AGE_MINUTES * minute,
  };
}

export function getClearCsrfCookieOptions(): CookieOptions {
  return withoutExpiry(getCsrfCookieOptions());
}
