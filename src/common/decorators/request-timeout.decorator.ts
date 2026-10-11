import { SetMetadata } from '@nestjs/common';

export const REQUEST_TIMEOUT_MS = 'request:timeout-ms';
export const RequestTimeout = (milliseconds: number) =>
  SetMetadata(REQUEST_TIMEOUT_MS, milliseconds);
