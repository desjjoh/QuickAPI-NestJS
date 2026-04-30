import { Module } from '@nestjs/common';
import { LibraryModule } from './library/library.module';
import { IdentityModule } from './identity/identity.module';

@Module({
  imports: [LibraryModule, IdentityModule],
  exports: [LibraryModule, IdentityModule],
})
export class DomainModule {}
