import { MODULE_METADATA } from '@nestjs/common/constants';
import { StorageModule } from '@/modules/system/storage/storage.module';
import { StorageService } from '@/modules/system/storage/types/storage.types';
import { CloudflareStorageService } from '@/modules/system/storage/services/cloudflare.r2.service';
import { parseEnv } from '@/config/environment.schema';

describe('StorageModule configuration contract', () => {
  it('binds the supported R2 provider and exports the generic storage contract', () => {
    const providers: readonly unknown[] = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      StorageModule,
    );
    expect(providers).toContainEqual({
      provide: StorageService,
      useClass: CloudflareStorageService,
    });
    const exports: readonly unknown[] = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      StorageModule,
    );
    expect(exports).toContain(StorageService);
    expect(
      parseEnv({ ...process.env, STORAGE_DRIVER: undefined }).STORAGE_DRIVER,
    ).toBe('r2');
  });
});
