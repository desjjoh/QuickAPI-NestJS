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
  region: string;
  exemplar_city: string;
};

const DEFAULT_LOCALE = 'en-CA';
const DEFAULT_OFFSET_DATE = new Date('1970-01-01T12:00:00.000Z');

const getTimeZoneName = (
  timeZone: string,
  timeZoneName: 'longGeneric' | 'short',
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
    const longName = getTimeZoneName(key, 'longGeneric');

    return {
      key,
      label: `${longName} - ${getExemplarCity(key)}`,
      long_name: longName,
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
