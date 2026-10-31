export type IdempotencyCallerScope = 'user' | 'public';

export type IdempotencyScope = {
  operation: string;
  route: string;
} & (
  | { callerScope?: 'user'; actorId: string }
  | { callerScope: 'public'; actorId?: never }
);

export type IdempotentResponse = { status: number; body: unknown };
