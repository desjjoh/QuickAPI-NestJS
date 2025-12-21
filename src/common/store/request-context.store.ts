import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export type RequestContextStore = {
  requestId: string;
  method: string;
  path: string;
  ip: string | undefined;
};

@Injectable()
export class RequestContext {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  public run(store: RequestContextStore, callback: () => void): void {
    this.storage.run(store, callback);
  }

  public get<T extends keyof RequestContextStore>(
    key: T,
  ): RequestContextStore[T] | undefined {
    const store = this.storage.getStore();

    return store?.[key];
  }

  public set<K extends keyof RequestContextStore>(
    key: K,
    value: RequestContextStore[K],
  ): void {
    const store = this.storage.getStore();
    if (!store) return;

    store[key] = value;
  }

  public getStore(): RequestContextStore | undefined {
    const store = this.storage.getStore();

    return store;
  }
}

export let requestContextRef: RequestContext | null = null;

export function attachRequestContext(ctx: RequestContext): void {
  requestContextRef = ctx;
}
