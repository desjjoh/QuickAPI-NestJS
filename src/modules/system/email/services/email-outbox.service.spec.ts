import {
  EmailOutboxService,
  openEmail,
  sealEmail,
} from './email-outbox.service';
import { EmailIntentEntity } from '../entities/email-intent.entity';

describe('EmailOutboxService', () => {
  it('bounds offline queue waits so the dispatcher releases its database locks', async () => {
    jest.useFakeTimers();
    try {
      repository.findDue.mockResolvedValue([intent()]);
      queue.enqueueDelivery.mockReturnValue(new Promise(() => undefined));
      const dispatch = service.dispatch();
      await jest.advanceTimersByTimeAsync(5_000);
      await dispatch;
      expect(manager.update).not.toHaveBeenCalledWith(
        EmailIntentEntity,
        { delivery_id: 'delivery-id' },
        expect.anything(),
      );
    } finally {
      jest.useRealTimers();
    }
  });
  const payload = {
    to: 'person@example.test',
    subject: 'Verify',
    htmlBody: '<p>123456</p>',
    messageStream: 'outbound',
  };
  const manager = {
    transaction: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
  };
  const repository = {
    manager,
    findDue: jest.fn(),
    findForDelivery: jest.fn(),
  };
  const queue = { enqueueDelivery: jest.fn() };
  const transport = { sendCompiledEmail: jest.fn() };
  const service = new EmailOutboxService(
    repository as never,
    queue as never,
    transport as never,
  );
  const intent = (overrides = {}) => ({
    delivery_id: 'delivery-id',
    state: 'pending',
    ciphertext: sealEmail(payload),
    expires_at: new Date(Date.now() + 60_000),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOne.mockResolvedValue({ id: 'user-1' });
    manager.transaction.mockImplementation(async (work) => work(manager));
    queue.enqueueDelivery.mockResolvedValue(undefined);
    transport.sendCompiledEmail.mockResolvedValue(undefined);
    repository.findDue.mockResolvedValue([]);
  });

  it('does not persist delivery intents for a deleted user', async () => {
    manager.findOne.mockResolvedValue({
      id: 'deleted-user',
      status: { key: 'deleted' },
    });
    await service.storeIntent({
      ...payload,
      metadata: { userId: 'deleted-user' },
    });
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('cancels encrypted pending messages for either the user ID or recipient, without touching others', async () => {
    const pending = [
      {
        delivery_id: 'a',
        ciphertext: sealEmail({
          ...payload,
          to: 'changed@example.test',
          metadata: { userId: 'user-1' },
        }),
      },
      { delivery_id: 'b', ciphertext: sealEmail(payload) },
      {
        delivery_id: 'c',
        ciphertext: sealEmail({ ...payload, to: 'other@example.test' }),
      },
    ];
    const query = {
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      take: jest.fn(),
      getMany: jest
        .fn()
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce([]),
    };
    for (const key of ['where', 'andWhere', 'orderBy', 'take'] as const)
      query[key].mockReturnValue(query);
    const persistence = { createQueryBuilder: () => query };
    await service.cancelForUser('user-1', 'PERSON@example.test', {
      ...manager,
      getRepository: () => persistence,
    } as never);
    expect(manager.update).toHaveBeenCalledTimes(2);
    for (const id of ['a', 'b'])
      expect(manager.update).toHaveBeenCalledWith(
        EmailIntentEntity,
        { delivery_id: id, state: 'pending' },
        { state: 'cancelled', ciphertext: null },
      );
  });

  it('encrypts email secrets with randomized authenticated encryption', () => {
    const sealed = sealEmail(payload);
    expect(openEmail(sealed)).toEqual(payload);
    expect(sealed).not.toContain(payload.to);
    expect(sealed).not.toContain('123456');
    expect(sealEmail(payload)).not.toBe(sealed);
    const parts = sealed.split('.');
    parts[2] = Buffer.alloc(20).toString('base64');
    expect(() => openEmail(parts.join('.'))).toThrow();
    expect(() => openEmail('malformed')).toThrow();
  });

  it('persists a stable identifier without enqueueing before commit', async () => {
    const expiry = new Date(Date.now() + 60_000);
    await service.storeIntent(payload, expiry, 'scope');
    expect(manager.update).toHaveBeenCalledWith(
      EmailIntentEntity,
      { cancellation_scope: 'scope', state: 'pending' },
      { state: 'cancelled', ciphertext: null },
    );
    const stored = manager.insert.mock.calls[0][1];
    expect(stored.delivery_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(stored.expires_at).toEqual(expiry);
    expect(openEmail(stored.ciphertext)).toEqual(payload);
    expect(queue.enqueueDelivery).not.toHaveBeenCalled();
  });

  it('dispatches only identifiers and leaves failed enqueue attempts pending', async () => {
    repository.findDue.mockResolvedValue([intent()]);
    queue.enqueueDelivery.mockRejectedValue(new Error('Redis unavailable'));
    await service.dispatch();
    expect(queue.enqueueDelivery).toHaveBeenCalledWith('delivery-id');
    expect(manager.update).not.toHaveBeenCalledWith(
      EmailIntentEntity,
      { delivery_id: 'delivery-id' },
      expect.anything(),
    );
    queue.enqueueDelivery.mockResolvedValue(undefined);
    await service.dispatch();
    expect(queue.enqueueDelivery).toHaveBeenNthCalledWith(2, 'delivery-id');
    expect(manager.update).toHaveBeenCalledWith(
      EmailIntentEntity,
      { delivery_id: 'delivery-id' },
      { available_at: expect.any(Date) },
    );
  });

  it('delivers with stable provider metadata and erases the encrypted payload', async () => {
    repository.findForDelivery.mockResolvedValue(intent());
    await service.deliver('delivery-id');
    expect(transport.sendCompiledEmail).toHaveBeenCalledWith({
      ...payload,
      metadata: { deliveryId: 'delivery-id' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      EmailIntentEntity,
      { delivery_id: 'delivery-id' },
      { state: 'delivered', delivered_at: expect.any(Date), ciphertext: null },
    );
  });

  it.each(['delivered', 'cancelled', 'expired'])(
    'does not redeliver %s intents',
    async (state) => {
      repository.findForDelivery.mockResolvedValue(intent({ state }));
      await service.deliver('delivery-id');
      expect(transport.sendCompiledEmail).not.toHaveBeenCalled();
    },
  );

  it('expires challenges without sending their codes', async () => {
    repository.findForDelivery.mockResolvedValue(
      intent({ expires_at: new Date(0) }),
    );
    await service.deliver('delivery-id');
    expect(transport.sendCompiledEmail).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(
      EmailIntentEntity,
      { delivery_id: 'delivery-id' },
      { state: 'expired', ciphertext: null },
    );
  });

  it('keeps intent pending when provider delivery fails', async () => {
    repository.findForDelivery.mockResolvedValue(intent());
    transport.sendCompiledEmail.mockRejectedValue(
      new Error('provider timeout'),
    );
    await expect(service.deliver('delivery-id')).rejects.toThrow(
      'provider timeout',
    );
    expect(manager.update).not.toHaveBeenCalled();
  });
});
