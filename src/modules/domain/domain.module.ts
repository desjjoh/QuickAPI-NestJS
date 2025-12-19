import { Module } from '@nestjs/common';
import { ItemsDomainModule } from './items/items.module';

@Module({
  imports: [ItemsDomainModule],
  exports: [ItemsDomainModule],
})
export class DomainModule {}
