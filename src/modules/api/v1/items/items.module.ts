import { Module } from '@nestjs/common';

import { ItemsDomainModule } from '@/modules/domain/items/items.module';

import { ItemsApiService } from './services/items.service';
import { ItemsApiController } from './controllers/items.controller';

@Module({
  imports: [ItemsDomainModule],
  providers: [ItemsApiService],
  controllers: [ItemsApiController],
})
export class ItemsApiModule {}
