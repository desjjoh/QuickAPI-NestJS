import { DataSource, Repository } from 'typeorm';

import { TimezoneEntity } from '@/modules/domain/library/entities/time-zone.entity';
import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';

type TimezoneSeed = {
  key: string;
  label: string;
  long_name: string;
  short_name: string;
  offset_minutes: number;
  offset_label: string;
  region: string;
  exemplar_city: string;
};

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_OFFSET_DATE = new Date('2026-01-01T12:00:00.000Z');

const formatOffsetLabel = (offsetMinutes: number): string => {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (absoluteMinutes % 60).toString().padStart(2, '0');

  return `GMT${sign}${hours}:${minutes}`;
};

const getOffsetMinutes = (timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(DEFAULT_OFFSET_DATE);
  const values = Object.fromEntries(
    parts.map((part: Intl.DateTimeFormatPart) => [part.type, part.value]),
  );
  const utcTimestamp = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return Math.round((utcTimestamp - DEFAULT_OFFSET_DATE.getTime()) / 60000);
};

const getTimeZoneName = (
  timeZone: string,
  timeZoneName: 'long' | 'short',
): string => {
  const formatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone,
    timeZoneName,
  });

  return (
    formatter
      .formatToParts(DEFAULT_OFFSET_DATE)
      .find((part: Intl.DateTimeFormatPart) => part.type === 'timeZoneName')
      ?.value ?? timeZone
  );
};

const getExemplarCity = (timeZone: string): string => {
  const [, ...segments] = timeZone.split('/');
  const city = segments.at(-1) ?? timeZone;

  return city.replace(/_/g, ' ');
};

const buildTimezoneSeeds = (): TimezoneSeed[] => {
  const supportedValues = Intl.supportedValuesOf?.('timeZone') ?? ['UTC'];
  const keys = supportedValues.includes('UTC')
    ? supportedValues
    : ['UTC', ...supportedValues];

  return keys.map((key: string): TimezoneSeed => {
    const offsetMinutes = getOffsetMinutes(key);
    const offsetLabel = formatOffsetLabel(offsetMinutes);
    const longName = getTimeZoneName(key, 'long');
    const shortName = getTimeZoneName(key, 'short');

    return {
      key,
      label: `(${offsetLabel}) ${longName} - ${key}`,
      long_name: longName,
      short_name: shortName,
      offset_minutes: offsetMinutes,
      offset_label: offsetLabel,
      region: key.split('/')[0] ?? key,
      exemplar_city: getExemplarCity(key),
    };
  });
};

export class TimezoneSeeder implements Seeder {
  public readonly name: string = TimezoneSeeder.name;
  public readonly order: number = 25;

  public async run(dataSource: DataSource): Promise<SeederResult> {
    const repository: Repository<TimezoneEntity> =
      dataSource.getRepository(TimezoneEntity);

    let created = 0;
    let skipped = 0;

    for (const seed of buildTimezoneSeeds()) {
      const existingTimezone: TimezoneEntity | null = await repository.findOne({
        where: { key: seed.key },
      });

      if (existingTimezone) {
        skipped += 1;
        continue;
      }

      await repository.save(repository.create(seed));
      created += 1;
    }

    return { created, skipped };
  }
}
