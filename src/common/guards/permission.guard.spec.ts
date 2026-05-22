import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permission.guard';

describe('PermissionsGuard', () => {
  it('passes when no required permissions', async () => {
    const guard = new PermissionsGuard({ get: () => [] } as never);
    await expect(
      guard.canActivate({
        getHandler: () => jest.fn(),
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as never),
    ).resolves.toBe(true);
  });

  it('fails when user missing', async () => {
    const guard = new PermissionsGuard({ get: () => ['x'] } as never);
    await expect(
      guard.canActivate({
        getHandler: () => jest.fn(),
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });
});
