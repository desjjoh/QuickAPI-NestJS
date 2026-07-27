import { Logger } from '@nestjs/common';
import type { Request } from 'express';

import { IpLocationService } from './ip-location.service';

type MaxMindRecord = {
  country?: { iso_code?: string; names?: { en?: string } };
  registered_country?: { iso_code?: string; names?: { en?: string } };
  subdivisions?: Array<{ iso_code?: string; names?: { en?: string } }>;
  city?: { names?: { en?: string } };
};
type Reader = { get(ip: string): MaxMindRecord | null };

class TestIpLocationService extends IpLocationService {
  public readonly opened: string[] = [];

  public constructor(private readonly readers: Record<string, Reader | Error>) {
    super();
  }

  protected override async openReader(filename: string): Promise<Reader> {
    this.opened.push(filename);
    const result = this.readers[filename];
    if (result instanceof Error) throw result;
    if (!result) throw new Error(`${filename} is not installed`);
    return result;
  }
}

class BaseReaderIpLocationService extends IpLocationService {
  public open(filename: string): Promise<Reader> {
    return super.openReader(filename);
  }
}

function request(ip: string | null): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

describe('IpLocationService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns City database country, region, and city data', async () => {
    const service = new TestIpLocationService({
      'GeoLite2-City.mmdb': {
        get: jest.fn().mockReturnValue({
          country: { iso_code: 'CA', names: { en: 'Canada' } },
          subdivisions: [{ iso_code: 'ON', names: { en: 'Ontario' } }],
          city: { names: { en: 'Ottawa' } },
        }),
      },
    });

    await expect(service.resolve(request('8.8.8.8'))).resolves.toMatchObject({
      ip: '8.8.8.8',
      countryCode: 'CA',
      countryName: 'Canada',
      regionCode: 'ON',
      regionName: 'Ontario',
      city: 'Ottawa',
      source: 'maxmind',
    });
    expect(service.opened).toEqual(['GeoLite2-City.mmdb']);
  });

  it('falls back to Country when the City database cannot be opened', async () => {
    const service = new TestIpLocationService({
      'GeoLite2-City.mmdb': new Error('corrupt city database'),
      'GeoLite2-Country.mmdb': {
        get: jest.fn().mockReturnValue({
          country: { iso_code: 'CA', names: { en: 'Canada' } },
        }),
      },
    });

    await expect(service.resolve(request('8.8.8.8'))).resolves.toMatchObject({
      countryCode: 'CA',
      countryName: 'Canada',
      regionCode: null,
      regionName: null,
      city: null,
      source: 'maxmind',
    });
    expect(service.opened).toEqual([
      'GeoLite2-City.mmdb',
      'GeoLite2-Country.mmdb',
    ]);
  });

  it('does not load MaxMind when the requested database is absent', async () => {
    const service = new BaseReaderIpLocationService();

    await expect(service.open('not-installed.mmdb')).rejects.toThrow(
      'not-installed.mmdb does not exist',
    );
  });

  it('shares reader initialization between concurrent lookups', async () => {
    const reader = {
      get: jest.fn().mockReturnValue({
        country: { iso_code: 'CA', names: { en: 'Canada' } },
      }),
    };
    const service = new TestIpLocationService({
      'GeoLite2-City.mmdb': reader,
    });

    const locations = await Promise.all([
      service.resolve(request('8.8.8.8')),
      service.resolve(request('1.1.1.1')),
    ]);

    expect(locations).toHaveLength(2);
    expect(service.opened).toEqual(['GeoLite2-City.mmdb']);
    expect(reader.get).toHaveBeenCalledTimes(2);
  });

  it('preserves private and loopback addresses without looking them up', async () => {
    const service = new TestIpLocationService({});

    for (const ip of ['127.0.0.1', '10.0.0.8', '::1']) {
      await expect(service.resolve(request(ip))).resolves.toMatchObject({
        ip,
        countryCode: null,
        countryName: null,
        regionCode: null,
        regionName: null,
        city: null,
        source: 'unknown',
      });
    }
    expect(service.opened).toHaveLength(0);
  });

  it('returns unknown and preserves the IP when a lookup throws', async () => {
    const service = new TestIpLocationService({
      'GeoLite2-City.mmdb': {
        get: () => {
          throw new Error('lookup error');
        },
      },
    });

    await expect(service.resolve(request('8.8.8.8'))).resolves.toMatchObject({
      ip: '8.8.8.8',
      countryCode: null,
      countryName: null,
      regionCode: null,
      regionName: null,
      city: null,
      source: 'unknown',
    });
  });
});
