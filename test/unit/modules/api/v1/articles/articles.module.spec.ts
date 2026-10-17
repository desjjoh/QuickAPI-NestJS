import { MODULE_METADATA } from '@nestjs/common/constants';

import { TokenModule } from '@/modules/system/tokens/token.module';
import { ArticlesModule } from '@/modules/domain/articles/articles.module';

import { AdministrationApiModule } from '@/modules/api/v1/administration/administration.module';
import { ArticlesApiModule } from '@/modules/api/v1/articles/articles.module';
import { PublicApiModule } from '@/modules/api/v1/public/public.module';
import { PublicArticleController } from '@/modules/api/v1/public/controllers/public-articles.controller';

describe('article API module dependencies', () => {
  it('registers public reads only in the public API module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PublicApiModule),
    ).toContain(PublicArticleController);
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ArticlesApiModule),
    ).not.toContain(PublicArticleController);
  });

  it.each([ArticlesApiModule, PublicApiModule, AdministrationApiModule])(
    '%s uses the shared articles domain module',
    (moduleType) => {
      expect(
        Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleType),
      ).toContain(ArticlesModule);
    },
  );
  it.each([ArticlesApiModule, AdministrationApiModule])(
    '%s imports the token provider required by CsrfGuard',
    (moduleType) => {
      const imports = Reflect.getMetadata(
        MODULE_METADATA.IMPORTS,
        moduleType,
      ) as unknown[];

      expect(imports).toContain(TokenModule);
    },
  );
});
