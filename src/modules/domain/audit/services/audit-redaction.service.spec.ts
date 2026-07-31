import { AuditRedactionService } from './audit-redaction.service';
import { AuditPolicyRegistry } from './audit-policy.registry';
import { scalar } from '../types/audit-policy.types';

describe(AuditRedactionService.name, () => {
  const secrets = {
    password: 'password-value',
    refresh: 'refresh-value',
    token: 'token-value',
    token_hash: 'token-hash-value',
    mfa_code_hash: 'mfa-hash-value',
    verification_code: 'verification-value',
    resetCode: 'reset-value',
    authorization: 'Bearer bearer-value',
    cookie: 'session=cookie-value',
    encryption_secret: 'crypto-value',
    postmark_server_token: 'postmark-value',
    r2_secret_access_key: 'r2-value',
  };

  it('supports independently registered domain policies', () => {
    const registry = new AuditPolicyRegistry(false);
    registry.register('store.product', { id: scalar, sku: scalar });
    registry.register('support.ticket', { id: scalar, state: scalar });
    const service = new AuditRedactionService({}, registry);

    expect(
      service.redactSnapshot('store.product', {
        id: 'product-1',
        sku: 'SKU-1',
        state: 'must-not-cross-domains',
      }),
    ).toEqual({ id: 'product-1', sku: 'SKU-1' });
    expect(
      service.redactSnapshot('support.ticket', {
        id: 'ticket-1',
        state: 'open',
        sku: 'must-not-cross-domains',
      }),
    ).toEqual({ id: 'ticket-1', state: 'open' });
  });

  it('rejects snapshots without a registered policy', () => {
    expect(() =>
      new AuditRedactionService().redactSnapshot('store.product', {
        secret: 'unsafe',
      }),
    ).toThrow('No audit redaction policy registered for store.product');
  });

  it('uses explicit entity allowlists and applies the documented personal-data policy', () => {
    const service = new AuditRedactionService();
    const snapshot = service.redactSnapshot('identity.user', {
      id: 'user-1',
      identity: { email: 'person@example.test', ...secrets },
      metadata: {
        mfa_enabled: true,
        registration: { password: 'registered-hash' },
      },
      unknown: 'must-not-appear',
      ...secrets,
    });

    expect(snapshot).toEqual({
      id: 'user-1',
      identity: { email: 'p***@example.test', password: '[CHANGED]' },
      metadata: { mfa_enabled: '[CHANGED]' },
    });
    expect(JSON.stringify(snapshot)).not.toContain('must-not-appear');
    expect(JSON.stringify(snapshot)).not.toContain('registered-hash');
    for (const value of Object.values(secrets))
      expect(JSON.stringify(snapshot)).not.toContain(value);
  });

  it('prevents sensitive values from entering diffs', () => {
    const service = new AuditRedactionService();
    const diff = service.redactDiff(
      'identity.profile',
      { id: 'p1', phone: '+15550000001', address: 'old secret address' },
      {
        id: 'p1',
        phone: '+15550000002',
        address: 'new secret address',
        date_of_birth: '2000-01-01',
        password: 'diff-password',
      },
    );
    const serialized = JSON.stringify(diff);

    expect(diff.after).toEqual({ date_of_birth: '[CHANGED]' });
    expect(diff.changes).toEqual({
      date_of_birth: { before: null, after: '[CHANGED]' },
    });
    expect(serialized).not.toMatch(
      /1555|secret address|2000-01-01|diff-password/,
    );
  });

  it('allowlists metadata and excludes request bodies, headers, errors, and credentials', () => {
    const service = new AuditRedactionService();
    const metadata = service.redactMetadata({
      request_id: 'request-1',
      ip: '203.0.113.42',
      user_agent: 'private browser fingerprint',
      body: { email: 'body@example.test', password: 'body-password' },
      headers: {
        authorization: 'Bearer metadata-token',
        cookie: 'private-cookie',
      },
      exception: new Error('metadata exception'),
      registration_token_metadata: { password: 'registration-password-hash' },
      ...secrets,
    });
    const serialized = JSON.stringify(metadata);

    expect(metadata).toMatchObject({
      request_id: 'request-1',
      ip: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      user_agent: '[CHANGED]',
    });
    expect(serialized).not.toMatch(
      /203\.0\.113\.42|browser fingerprint|body@example|body-password|metadata-token|private-cookie|metadata exception|registration-password/,
    );
    for (const value of Object.values(secrets))
      expect(serialized).not.toContain(value);
  });

  it('serializes only a safe error type', () => {
    const service = new AuditRedactionService();
    const error = Object.assign(new Error('Bearer serialized-error-token'), {
      password: 'error-password',
      response: { body: 'raw-error-body' },
    });
    const serialized = JSON.stringify(service.serializeError(error));

    expect(JSON.parse(serialized)).toEqual({
      type: 'Error',
      message: '[REDACTED]',
    });
    expect(serialized).not.toMatch(
      /serialized-error-token|error-password|raw-error-body|stack/,
    );
  });

  it('normalizes relationship objects and ID strings without retaining related details', () => {
    const service = new AuditRedactionService({ maxArrayLength: 2 });
    const role = {
      name: 'reader',
      id: 'role-2',
      permissions: [{ id: 'permission-1' }],
    };
    const entity: Record<string, unknown> = {
      updated_at: new Date('2026-01-02T03:04:05.000Z'),
      roles: [role, 'role-1'],
      id: 'user-1',
      profile: Buffer.from('raw bytes'),
    };
    role['users' as keyof typeof role] = entity as never;

    const first = service.redactSnapshot('identity.user', entity);
    const second = service.redactSnapshot('identity.user', entity);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toMatchObject({
      id: 'user-1',
      roles: ['role-1', 'role-2'],
      updated_at: '2026-01-02T03:04:05.000Z',
    });
    expect(JSON.stringify(first)).not.toMatch(/reader|permission-1|users/);
  });

  it('removes duplicate and unusable relationship IDs', () => {
    const service = new AuditRedactionService();

    expect(
      service.redactSnapshot('identity.user', {
        roles: [
          'role-2',
          { id: 'role-1', label: 'User' },
          { id: 'role-2', nested: { private: true } },
          { label: 'missing ID' },
          { id: 42 },
          '',
          null,
        ],
      }),
    ).toEqual({ roles: ['role-1', 'role-2'] });
  });

  it('rejects a nested object supplied to a collection relationship policy', () => {
    const service = new AuditRedactionService();

    const snapshot = service.redactSnapshot('identity.user', {
      roles: {
        id: 'role-1',
        arbitrary: { secret: 'must-not-be-serialized' },
      },
    });

    expect(snapshot).toEqual({ roles: [] });
    expect(JSON.stringify(snapshot)).not.toContain('must-not-be-serialized');
  });

  it('does not report reordered unordered relationships as changed', () => {
    const service = new AuditRedactionService();
    const diff = service.redactDiff(
      'identity.user',
      { id: 'user-1', roles: ['role-2', 'role-1'] },
      { id: 'user-1', roles: [{ id: 'role-1' }, { id: 'role-2' }] },
    );

    expect(diff).toEqual({ before: {}, after: {}, changes: {} });
  });

  it('reports added and removed relationship IDs with useful snapshots', () => {
    const service = new AuditRedactionService();
    const diff = service.redactDiff(
      'identity.user',
      { id: 'user-1', roles: ['role-1', 'role-2'] },
      { id: 'user-1', roles: ['role-2', 'role-3'] },
    );

    expect(diff).toEqual({
      before: { roles: ['role-1', 'role-2'] },
      after: { roles: ['role-2', 'role-3'] },
      changes: {
        roles: {
          before: ['role-1', 'role-2'],
          after: ['role-2', 'role-3'],
          added_ids: ['role-3'],
          removed_ids: ['role-1'],
        },
      },
    });
  });

  it('returns changed-only scalar values and a structured scalar change', () => {
    const service = new AuditRedactionService();

    expect(
      service.redactDiff(
        'identity.role',
        { id: 'role-1', name: 'Reader', active: true },
        { id: 'role-1', name: 'Writer', active: true },
      ),
    ).toEqual({
      before: { name: 'Reader' },
      after: { name: 'Writer' },
      changes: { name: { before: 'Reader', after: 'Writer' } },
    });
  });

  it('retains only changed paths in a nested one-to-one object', () => {
    const service = new AuditRedactionService();

    expect(
      service.redactDiff(
        'identity.user',
        { profile: { id: 'p1', name: { first: 'Old', last: 'Same' } } },
        { profile: { id: 'p1', name: { first: 'New', last: 'Same' } } },
      ),
    ).toEqual({
      before: { profile: { name: { first: 'Old' } } },
      after: { profile: { name: { first: 'New' } } },
      changes: {
        profile: { name: { first: { before: 'Old', after: 'New' } } },
      },
    });
  });

  it.each([
    ['addition', ['role-1'], ['role-1', 'role-2'], ['role-2'], []],
    ['removal', ['role-1', 'role-2'], ['role-1'], [], ['role-2']],
    ['replacement', ['role-1'], ['role-2'], ['role-2'], ['role-1']],
  ])('structures a relationship %s', (_case, before, after, added, removed) => {
    const diff = new AuditRedactionService().redactDiff(
      'identity.user',
      { roles: before },
      { roles: after },
    );

    expect(diff.changes).toEqual({
      roles: {
        before,
        after,
        added_ids: added,
        removed_ids: removed,
      },
    });
  });

  it('combines scalar and relationship changes without unchanged fields', () => {
    const service = new AuditRedactionService();
    const diff = service.redactDiff(
      'identity.user',
      { id: 'user-1', active: true, roles: ['role-1'] },
      { id: 'user-1', active: false, roles: ['role-1', 'role-2'] },
    );

    expect(diff.before).toEqual({ active: true, roles: ['role-1'] });
    expect(diff.after).toEqual({
      active: false,
      roles: ['role-1', 'role-2'],
    });
    expect(diff.changes).toEqual({
      active: { before: true, after: false },
      roles: {
        before: ['role-1'],
        after: ['role-1', 'role-2'],
        added_ids: ['role-2'],
        removed_ids: [],
      },
    });
  });

  it('truncates normalized relationship IDs at the configured limit', () => {
    const service = new AuditRedactionService({ maxArrayLength: 2 });

    expect(
      service.redactSnapshot('identity.user', {
        roles: ['role-3', 'role-1', 'role-2', 'role-2'],
      }),
    ).toEqual({ roles: ['role-1', 'role-2', '[TRUNCATED]'] });
  });

  it('cannot leak cyclic relation graphs through an ID-only policy', () => {
    const service = new AuditRedactionService();
    const user: Record<string, unknown> = { id: 'user-1' };
    const role = { id: 'role-1', label: 'Admin', users: [user] };
    user.roles = [role];
    role.users.push(role);

    const snapshot = service.redactSnapshot('identity.user', user);

    expect(snapshot).toEqual({ id: 'user-1', roles: ['role-1'] });
    expect(JSON.stringify(snapshot)).not.toMatch(/Admin|users|CIRCULAR/);
  });

  it('replaces oversized output with a deterministic marker', () => {
    const service = new AuditRedactionService({ maxBytes: 20 });
    expect(
      service.redactSnapshot('media.image', {
        id: 'image-1',
        filename: 'a'.repeat(100),
      }),
    ).toEqual({ truncated: '[TRUNCATED]' });
  });
});
