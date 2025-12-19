import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ItemEntity } from './entities/item.entity';
import { ItemsRepository } from './repository/items.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ItemEntity])],
  providers: [ItemsRepository],
  exports: [ItemsRepository],
})
export class ItemsDomainModule {}
