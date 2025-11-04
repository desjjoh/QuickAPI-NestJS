import { Module } from '@nestjs/common';
import { ItemsController } from './controllers/items.controller';
import { ItemsService } from './services/items.service';

/**
 * Mock Items module demonstrating DTO validation and controller wiring.
 */
@Module({
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
