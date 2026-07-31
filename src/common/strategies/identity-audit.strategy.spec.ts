import { UnauthorizedException } from '@nestjs/common';

import { LocalStrategy } from './local.strategy';
import { RefreshTokenStrategy } from './refresh.strategy';

describe('authentication strategy audit events', () => {
  it('does not audit rejected credentials', async () => {
    const error = new UnauthorizedException('Invalid credentials');
    const users = { validateUser: jest.fn().mockRejectedValue(error) };
    const strategy = new LocalStrategy(users as never);

    await expect(
      strategy.validate(' Person@Example.TEST ', 'not-recorded'),
    ).rejects.toBe(error);
  });

  it('does not audit an ordinary refresh validation failure', async () => {
    const repository = { findByIdOrFail: jest.fn(), manager: {} };
    const users = { assertCanAuthenticate: jest.fn() };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const strategy = new RefreshTokenStrategy(
      repository as never,
      users as never,
    );
    const payload = {
      sub: 'user-1',
      sid: 'session-1',
      email: 'not-audited@example.test',
      version: 1,
    };

    await expect(
      strategy.validate({ cookies: {} } as never, payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
