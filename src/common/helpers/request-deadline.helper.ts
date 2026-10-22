import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestTimeoutError } from '../exceptions/http.exception';

const deadlines = new AsyncLocalStorage<RequestDeadline>();

/** Cancellation signal, not permission to release resources still in use. */
export class RequestDeadline {
  private failure?: RequestTimeoutError;

  public constructor(private readonly expiresAt: number) {}

  public expire(message = 'Request deadline exceeded.'): RequestTimeoutError {
    this.failure ??= new RequestTimeoutError(message);

    return this.failure;
  }

  public assertActive(): void {
    if (Date.now() >= this.expiresAt) this.expire();
    if (this.failure) throw this.failure;
  }

  public run<T>(work: () => T): T {
    return deadlines.run(this, work);
  }
}

/** Workers and other non-HTTP transactions have no request deadline. */
export function assertRequestActive(): void {
  deadlines.getStore()?.assertActive();
}

/** Compensation/security accounting must still run after cancellation. */
export function withoutRequestDeadline<T>(work: () => T): T {
  return deadlines.exit(work);
}
