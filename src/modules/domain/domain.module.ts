import { Module } from '@nestjs/common';
import { ItemsDomainModule } from './items/items.module';
import { LibraryModule } from './library/library.module';
import { SharedDomainModule } from './shared/shared.module';
import { IdentityModule } from './identity/identity.module';

@Module({
  imports: [
    LibraryModule,
    SharedDomainModule,
    IdentityModule,
    ItemsDomainModule,
  ],
  exports: [
    LibraryModule,
    SharedDomainModule,
    IdentityModule,
    ItemsDomainModule,
  ],
})
export class DomainModule {}
