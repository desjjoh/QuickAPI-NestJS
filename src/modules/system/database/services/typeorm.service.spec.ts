import { DataSource } from 'typeorm';
import { TypeOrmService } from './typeorm.service';

describe('TypeOrmService', () => {
  it.each([
    [true, 'connected'],
    [false, 'disconnected'],
  ] as const)(
    'maps isInitialized=%s to %s without opening a real connection',
    async (isInitialized, expected) => {
      const dataSource = { isInitialized } as DataSource;
      await expect(new TypeOrmService(dataSource).get_status()).resolves.toBe(
        expected,
      );
    },
  );
});
