import { LC } from '@/common/handlers/lifecycle.handler';
import { TypeOrmService } from '@/modules/system/database/services/typeorm.service';
import { ApplicationControllerService } from './application.service';

describe('ApplicationControllerService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reports readiness only when lifecycle and database checks both succeed', async () => {
    jest.spyOn(LC, 'isReady').mockReturnValue(true);
    jest.spyOn(LC, 'areAllServicesHealthy').mockResolvedValue(true);

    const service = new ApplicationControllerService({
      get_status: jest.fn().mockResolvedValue('connected'),
    } as unknown as TypeOrmService);

    await expect(service.get_ready()).resolves.toEqual(
      expect.objectContaining({
        ready: true,
        status: 'ready',
        checks: [
          expect.objectContaining({ name: 'lifecycle', status: 'up' }),
          expect.objectContaining({ name: 'database', status: 'up' }),
        ],
      }),
    );
  });

  it('aggregates dependency errors as not ready instead of rejecting', async () => {
    jest.spyOn(LC, 'isReady').mockReturnValue(true);
    jest
      .spyOn(LC, 'areAllServicesHealthy')
      .mockRejectedValue(new Error('unhealthy'));

    const service = new ApplicationControllerService({
      get_status: jest.fn().mockRejectedValue(new Error('db unavailable')),
    } as unknown as TypeOrmService);

    const result = await service.get_ready();

    expect(result.ready).toBe(false);
    expect(result.checks.map(({ status }) => status)).toEqual(['down', 'down']);
  });

  it('bounds readiness when lifecycle and database clients never settle', async () => {
    jest.useFakeTimers();
    jest.spyOn(LC, 'isReady').mockReturnValue(true);
    jest
      .spyOn(LC, 'areAllServicesHealthy')
      .mockReturnValue(new Promise(() => undefined));

    const service = new ApplicationControllerService({
      get_status: jest.fn().mockReturnValue(new Promise(() => undefined)),
    } as unknown as TypeOrmService);

    const pending = service.get_ready();

    await jest.advanceTimersByTimeAsync(2000);

    const result = await pending;

    expect(result.ready).toBe(false);
    expect(result.checks.map(({ status }) => status)).toEqual(['down', 'down']);
  });
  it('keeps liveness independent of dependency health', () => {
    jest.spyOn(LC, 'isAlive').mockReturnValue(true);
    jest.spyOn(process, 'uptime').mockReturnValue(12.3456);

    expect(
      new ApplicationControllerService({} as TypeOrmService).get_health(),
    ).toEqual(
      expect.objectContaining({ alive: true, status: 'alive', uptime: 12.346 }),
    );
  });
});
