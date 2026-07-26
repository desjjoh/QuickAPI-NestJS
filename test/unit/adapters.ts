import type { Queue } from 'bullmq';
import type IORedis from 'ioredis';

import type { EmailJobPayload } from '@/modules/system/email/queues/jobs.types';
import type { EmailQueueService } from '@/modules/system/email/queues/queue.service';
import type { EmailService } from '@/modules/system/email/services/email.service';
import type { StorageService } from '@/modules/system/storage/types/storage.types';

export type MockEmailService = jest.Mocked<Pick<EmailService, 'sendEmail'>>;

export const mockEmailService = (): MockEmailService => ({
  sendEmail: jest.fn(),
});

export type MockEmailQueueService = jest.Mocked<
  Pick<EmailQueueService, 'enqueueEmail'>
>;

export const mockEmailQueueService = (): MockEmailQueueService => ({
  enqueueEmail: jest.fn(),
});

export type MockBullQueue<TJob = EmailJobPayload> = jest.Mocked<
  Pick<Queue<TJob>, 'add' | 'close' | 'getJob' | 'remove'>
>;

export const mockBullQueue = <
  TJob = EmailJobPayload,
>(): MockBullQueue<TJob> => ({
  add: jest.fn(),
  close: jest.fn(),
  getJob: jest.fn(),
  remove: jest.fn(),
});

export type MockRedis = jest.Mocked<
  Pick<IORedis, 'del' | 'disconnect' | 'expire' | 'get' | 'ping' | 'set'>
>;

export const mockRedis = (): MockRedis => ({
  del: jest.fn(),
  disconnect: jest.fn(),
  expire: jest.fn(),
  get: jest.fn(),
  ping: jest.fn(),
  set: jest.fn(),
});

export type MockStorageService = jest.Mocked<
  Pick<StorageService, 'deleteObject' | 'objectExists' | 'putObject'>
>;

export const mockStorageService = (): MockStorageService => ({
  deleteObject: jest.fn(),
  objectExists: jest.fn(),
  putObject: jest.fn(),
});
