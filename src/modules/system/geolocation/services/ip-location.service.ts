import { Injectable, Logger } from '@nestjs/common';
import { isIP } from 'node:net';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { Request } from 'express';

import { env } from '@/config/environment.config';
import { ConfigurationError } from '@/common/errors/config.error';

const loadMaxMind = async (): Promise<MaxMind> =>
  (await new Function('specifier', 'return import(specifier)')(
    'maxmind',
  )) as MaxMind;

type Reader = {
  get(ip: string): MaxMindRecord | null;
};

type MaxMind = {
  open<T>(file: string): Promise<{ get(ip: string): T | null }>;
};

type MaxMindRecord = {
  country?: {
    iso_code?: string;
    names?: {
      en?: string;
    };
  };

  registered_country?: {
    iso_code?: string;
    names?: {
      en?: string;
    };
  };

  subdivisions?: Array<{
    iso_code?: string;
    names?: {
      en?: string;
    };
  }>;

  city?: {
    names?: {
      en?: string;
    };
  };
};

export type SessionIpLocation = {
  ip: string | null;
  countryCode: string | null;
  countryName: string | null;
  regionCode: string | null;
  regionName: string | null;
  city: string | null;
  source: 'maxmind' | 'unknown';
  resolvedAt: Date;
};

export async function assertGeoLiteDatabasesAvailable(): Promise<void> {
  if (env.NODE_ENV === 'test') return;

  const required = ['GeoLite2-Country.mmdb', 'GeoLite2-City.mmdb'];

  const missing = required.filter((filename) => {
    return !existsSync(path.join(env.IP_LOCATION_DATA_DIR, filename));
  });

  if (missing.length > 0) {
    throw new ConfigurationError(
      `GeoLite2 database files are unavailable in ${env.IP_LOCATION_DATA_DIR}: ${missing.join(', ')}. Run npm run geoip:update before starting the API.`,
    );
  }

  try {
    const maxmind = await loadMaxMind();

    await Promise.all(
      required.map((filename) => {
        return maxmind.open<MaxMindRecord>(
          path.join(env.IP_LOCATION_DATA_DIR, filename),
        );
      }),
    );
  } catch {
    throw new ConfigurationError(
      `GeoLite2 databases in ${env.IP_LOCATION_DATA_DIR} could not be opened. Run npm run geoip:update to install valid files.`,
    );
  }
}

export async function checkGeoLiteDatabasesAvailable(): Promise<boolean> {
  try {
    await assertGeoLiteDatabasesAvailable();

    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class IpLocationService {
  private readonly logger = new Logger(IpLocationService.name);

  private reader: Reader | null | undefined;
  private readerInitialization: Promise<Reader | null> | undefined;

  public async resolve(req: Request): Promise<SessionIpLocation> {
    const ip = req.ip ?? req.socket.remoteAddress ?? null;
    const resolvedAt = new Date();

    if (!this.isPublicIp(ip)) return this.unknown(ip, resolvedAt);

    try {
      const record = (await this.getReader())?.get(ip);

      if (!record) return this.unknown(ip, resolvedAt);

      const country = record.country ?? record.registered_country;
      const region = record.subdivisions?.[0];

      return {
        ip,
        countryCode: country?.iso_code ?? null,
        countryName: country?.names?.en ?? null,
        regionCode: region?.iso_code ?? null,
        regionName: region?.names?.en ?? null,
        city: record.city?.names?.en ?? null,
        source: 'maxmind',
        resolvedAt,
      };
    } catch (error) {
      this.logger.warn(
        `MaxMind lookup failed; authentication will continue: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return this.unknown(ip, resolvedAt);
    }
  }

  private async getReader(): Promise<Reader | null> {
    if (this.reader !== undefined) return this.reader;

    this.readerInitialization ??= this.initializeReader();

    return this.readerInitialization;
  }

  private async initializeReader(): Promise<Reader | null> {
    if (this.reader !== undefined) return this.reader;

    const cityReader = await this.tryOpenReader('GeoLite2-City.mmdb');

    if (cityReader) {
      this.reader = cityReader;

      return this.reader;
    }

    this.logger.warn(
      'GeoLite2 City database is unavailable; falling back to GeoLite2 Country database.',
    );

    const countryReader = await this.tryOpenReader('GeoLite2-Country.mmdb');

    if (countryReader) {
      this.reader = countryReader;

      return this.reader;
    }

    if (env.NODE_ENV !== 'test') {
      this.logger.error(
        'No readable GeoLite2 database is available; location lookups will return unknown.',
      );
    }

    this.reader = null;

    return null;
  }

  protected async openReader(filename: string): Promise<Reader> {
    const databasePath = path.join(env.IP_LOCATION_DATA_DIR, filename);

    if (!existsSync(databasePath))
      throw new Error(`${databasePath} does not exist`);

    const maxmind = await loadMaxMind();

    return maxmind.open<MaxMindRecord>(databasePath);
  }

  private async tryOpenReader(filename: string): Promise<Reader | null> {
    try {
      return await this.openReader(filename);
    } catch (error) {
      this.logger.warn(
        `Unable to open ${filename}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private isPublicIp(ip: string | null): ip is string {
    return !!ip && isIP(ip) !== 0 && !this.isNonPublic(ip);
  }

  private isNonPublic(ip: string): boolean {
    if (ip.includes(':')) {
      return (
        ip === '::1' ||
        ip === '::' ||
        /^fe[89ab]/i.test(ip) ||
        /^(fc|fd)/i.test(ip)
      );
    }

    const [a, b] = ip.split('.').map(Number);

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  private unknown(ip: string | null, resolvedAt: Date): SessionIpLocation {
    return {
      ip,
      countryCode: null,
      countryName: null,
      regionCode: null,
      regionName: null,
      city: null,
      source: 'unknown',
      resolvedAt,
    };
  }
}
