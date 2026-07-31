import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export type ContextActorType =
  | 'user'
  | 'anonymous'
  | 'service'
  | 'admin'
  | 'system';
export type ContextSource =
  | 'http'
  | 'queue'
  | 'scheduled_job'
  | 'seed'
  | 'service'
  | 'migration'
  | 'system';
export type NonHttpContextSource = Exclude<ContextSource, 'http'>;

/** Deliberately contains only allowlisted correlation and audit attributes. */
export type RequestContextStore = {
  requestId: string;
  method?: string;
  normalizedRoute?: string;
  ipAddress?: string;
  actorId?: string;
  sessionId?: string;
  actorType?: ContextActorType;
  userAgent?: string;
  source?: ContextSource;
};

export type NonHttpContext = Omit<
  RequestContextStore,
  'method' | 'normalizedRoute' | 'ipAddress' | 'userAgent' | 'source'
> & {
  source: NonHttpContextSource;
};

@Injectable()
export class RequestContext {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  public run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  /** Run background work in an isolated, explicitly identified context. */
  public runNonHttp<T>(context: NonHttpContext, callback: () => T): T {
    return this.run(
      { actorType: context.actorType ?? 'system', ...context },
      callback,
    );
  }

  public get<T extends keyof RequestContextStore>(
    key: T,
  ): RequestContextStore[T] | undefined {
    return this.storage.getStore()?.[key];
  }

  public set<K extends keyof RequestContextStore>(
    key: K,
    value: RequestContextStore[K],
  ): void {
    const store = this.storage.getStore();
    if (store) store[key] = value;
  }

  public getStore(): RequestContextStore | undefined {
    return this.storage.getStore();
  }
}

export let requestContextRef: RequestContext | null = null;

export function attachRequestContext(ctx: RequestContext): void {
  requestContextRef = ctx;
}
