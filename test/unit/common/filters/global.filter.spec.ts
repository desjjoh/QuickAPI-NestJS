import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { logger } from '@/config/logger.config';
import {
  attachRequestContext,
  RequestContext,
} from '@/common/store/request-context.store';
import { PublicServiceUnavailableException } from '@/common/exceptions/public-service-unavailable.exception';
import { ValidationErrorException } from '@/common/exceptions/http.exception';
import { GlobalExceptionFilter } from '@/common/filters/global.filter';

describe('GlobalExceptionFilter privacy', () => {
  const context = new RequestContext();
  const secret = 'private@example.test Bearer super-secret password=hidden';
  let response: {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
    headersSent: boolean;
    destroyed: boolean;
  };
  let errorLog: jest.SpyInstance;
  let warnLog: jest.SpyInstance;
  const invoke = (error: unknown) =>
    context.run({ requestId: 'server-request-id' }, () =>
      new GlobalExceptionFilter().catch(error, {
        switchToHttp: () => ({ getResponse: () => response }),
      } as unknown as ArgumentsHost),
    );

  beforeEach(() => {
    attachRequestContext(context);
    response = {
      status: jest.fn(),
      json: jest.fn(),
      setHeader: jest.fn(),
      headersSent: false,
      destroyed: false,
    };
    response.status.mockReturnValue(response);
    errorLog = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    warnLog = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    new QueryFailedError(
      `SELECT ${secret}`,
      [secret],
      Object.assign(new Error(secret), { code: 'ER_DUP_ENTRY' }),
    ),
    Object.assign(new Error(secret), {
      response: { body: secret },
      request: { headers: { authorization: secret } },
    }),
    new InternalServerErrorException(secret),
    { message: secret, stack: secret },
    secret,
  ])(
    'returns generic 500 with correlation, never internal failure details',
    (error) => {
      invoke(error);
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        status: 500,
        message: 'Internal server error',
        timestamp: expect.any(Number),
        requestId: 'server-request-id',
      });
      expect(response.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        'server-request-id',
      );
      expect(errorLog).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'server-request-id',
          status: 500,
        }),
        'HTTP server failure.',
      );
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
      expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(
        /SELECT|authorization|parameters|stack/,
      );
    },
  );

  it.each([
    [new BadRequestException('Invalid request'), 400, 'Invalid request'],
    [new UnauthorizedException('Sign in required'), 401, 'Sign in required'],
    [new ForbiddenException('Permission required'), 403, 'Permission required'],
    [
      new ConflictException('Reload before retrying'),
      409,
      'Reload before retrying',
    ],
    [
      new ValidationErrorException([
        {
          property: 'title',
          constraints: { isString: 'title must be a string' },
        },
      ]),
      422,
      'Validation failed: title → title must be a string.',
    ],
  ])(
    'preserves intentional client-facing HTTP errors',
    (error, status, message) => {
      invoke(error);
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ message }),
      );
      expect(errorLog).not.toHaveBeenCalled();
      expect(warnLog).toHaveBeenCalled();
    },
  );

  it('generates a fallback correlation ID when no request context is active', () => {
    new GlobalExceptionFilter().catch(new Error(secret), {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost);
    const body = response.json.mock.calls[0][0];
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      body.requestId,
    );
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: body.requestId }),
      'HTTP server failure.',
    );
  });

  it('hides unreviewed upstream 503 messages while retaining the status', () => {
    invoke(new ServiceUnavailableException(secret));
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Service unavailable' }),
    );
  });

  it('preserves explicitly reviewed storage retry messages', () => {
    invoke(
      new PublicServiceUnavailableException(
        'Storage upload failed. Please retry.',
      ),
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 503,
        message: 'Storage upload failed. Please retry.',
      }),
    );
  });

  it.each(['headersSent', 'destroyed'] as const)(
    'does not write a second response when %s',
    (field) => {
      response[field] = true;
      invoke(new Error(secret));
      expect(errorLog).toHaveBeenCalled();
      expect(response.json).not.toHaveBeenCalled();
      expect(response.setHeader).not.toHaveBeenCalled();
    },
  );
});
