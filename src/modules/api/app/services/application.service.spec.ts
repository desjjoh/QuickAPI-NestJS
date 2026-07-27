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

  it('returns the root API message', () => {
    const service = new ApplicationControllerService({} as TypeOrmService);

    expect(service.get_root('QuickAPI is running')).toEqual(
      expect.objectContaining({ message: 'QuickAPI is running' }),
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

  it('reports not ready when lifecycle or database status is unavailable', async () => {
    jest.spyOn(LC, 'isReady').mockReturnValue(false);
    jest.spyOn(LC, 'areAllServicesHealthy').mockResolvedValue(true);
    const service = new ApplicationControllerService({
      get_status: jest.fn().mockResolvedValue('disconnected'),
    } as unknown as TypeOrmService);

    const result = await service.get_ready();

    expect(result.ready).toBe(false);
    expect(result.checks).toEqual([
      expect.objectContaining({ name: 'lifecycle', status: 'down' }),
      expect.objectContaining({ name: 'database', status: 'down' }),
    ]);
    expect(LC.areAllServicesHealthy).not.toHaveBeenCalled();
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

  it('describes the running application and process', () => {
    jest.spyOn(process, 'uptime').mockReturnValue(60);
    const service = new ApplicationControllerService({} as TypeOrmService);

    const result = service.get_info();

    expect(result).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        version: expect.any(String),
        environment: 'test',
        hostname: expect.any(String),
        pid: process.pid,
        node_version: process.version,
        platform: process.platform,
        architecture: process.arch,
        started_at: expect.any(String),
        timezone: expect.any(String),
      }),
    );
    expect(Date.parse(result.started_at)).not.toBeNaN();
  });

  it('returns database, CPU, memory, process, and operating-system metrics', async () => {
    const get_status = jest.fn().mockResolvedValue('connected');
    const service = new ApplicationControllerService({
      get_status,
    } as unknown as TypeOrmService);

    const result = await service.get_system();

    expect(result).toEqual(
      expect.objectContaining({
        uptime: expect.any(Number),
        timestamp: expect.any(Number),
        event_loop_lag: expect.any(Number),
        db: 'connected',
        cpu: expect.objectContaining({
          cores: expect.any(Number),
          model: expect.any(String),
          load_average: expect.any(Array),
        }),
        memory: expect.objectContaining({
          total_bytes: expect.any(Number),
          free_bytes: expect.any(Number),
          used_bytes: expect.any(Number),
          used_percent: expect.any(Number),
        }),
        process: expect.objectContaining({
          rss_bytes: expect.any(Number),
          heap_total_bytes: expect.any(Number),
          heap_used_bytes: expect.any(Number),
          external_bytes: expect.any(Number),
          active_handles: expect.any(Number),
        }),
        os: expect.objectContaining({
          type: expect.any(String),
          release: expect.any(String),
          uptime: expect.any(Number),
        }),
      }),
    );
    expect(get_status).toHaveBeenCalledTimes(1);
  });
});
