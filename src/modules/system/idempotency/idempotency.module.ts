import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyEntity } from './entities/idempotency.entity';
import { IdempotencyRepository } from './repositories/idempotency.repository';
import { IdempotencyService } from './services/idempotency.service';
import { IdempotencyInterceptor } from '@/common/interceptors/idempotency.interceptor';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyEntity]), TransactionsModule],
  providers: [
    IdempotencyRepository,
    IdempotencyService,
    IdempotencyInterceptor,
  ],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
