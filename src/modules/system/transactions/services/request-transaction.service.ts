import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  runInTransaction,
  type TransactionWork,
} from '@/common/helpers/transaction.helper';

/** HTTP transaction entry point; domain services consume its shared context. */
@Injectable()
export class RequestTransactionService {
  public constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
  ) {}

  public run<T>(work: TransactionWork<T>): Promise<T> {
    return runInTransaction(this.manager, work);
  }
}
