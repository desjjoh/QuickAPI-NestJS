import { Module } from '@nestjs/common';
import { ItemsDomainModule } from './items/items.module';
import { LibraryModule } from './library/library.module';

@Module({
  imports: [ItemsDomainModule, LibraryModule],
  exports: [ItemsDomainModule, LibraryModule],
})
export class DomainModule {}
