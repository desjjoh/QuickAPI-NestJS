import { MODULE_METADATA } from '@nestjs/common/constants';
import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { LibraryModule } from '@/modules/domain/library/library.module';
import { PublicApiModule } from '@/modules/api/v1/public/public.module';
import { AccountStatusRepository } from '@/modules/domain/identity/repositories/accountstatus.repository';
import { GenderRepository } from '@/modules/domain/identity/repositories/gender.repository';
import { PermissionRepository } from '@/modules/domain/identity/repositories/permission.repository';
import { RoleRepository } from '@/modules/domain/identity/repositories/role.repository';

describe('identity reference ownership', () => {
  it.each([
    AccountStatusRepository,
    GenderRepository,
    PermissionRepository,
    RoleRepository,
  ])('%p is provided/exported by identity, not library', (repository) => {
    for (const key of [MODULE_METADATA.PROVIDERS, MODULE_METADATA.EXPORTS]) {
      expect(Reflect.getMetadata(key, IdentityModule)).toContain(repository);
      expect(Reflect.getMetadata(key, LibraryModule)).not.toContain(repository);
    }
  });

  it('keeps library API composition separate from domain ownership', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, PublicApiModule),
    ).toEqual(expect.arrayContaining([LibraryModule, IdentityModule]));
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, LibraryModule),
    ).not.toContain(IdentityModule);
  });
});
