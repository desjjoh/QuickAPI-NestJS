import { UseInterceptors } from '@nestjs/common';
import { TransactionInterceptor } from '../interceptors/transaction.interceptor';

/** Complete handler work and its audits before committing the HTTP operation. */
export const Transactional = () => UseInterceptors(TransactionInterceptor);
