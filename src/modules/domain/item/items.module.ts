import { Module } from '@nestjs/common';
import { ItemsController } from './controllers/items.controller';
import { ItemsService } from './services/items.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemEntity } from '@/modules/system/database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([ItemEntity])],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [TypeOrmModule, ItemsService],
})
export class ItemsModule {}
