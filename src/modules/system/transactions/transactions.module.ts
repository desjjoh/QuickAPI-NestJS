import { Module } from '@nestjs/common';
import { TransactionInterceptor } from '@/common/interceptors/transaction.interceptor';
import { RequestTransactionService } from './services/request-transaction.service';

@Module({
  providers: [RequestTransactionService, TransactionInterceptor],
  exports: [RequestTransactionService, TransactionInterceptor],
})
export class TransactionsModule {}
