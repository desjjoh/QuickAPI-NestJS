import { AuditRedactionService } from './audit-redaction.service';

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

  it('uses explicit entity allowlists and applies the documented personal-data policy', () => {
    const service = new AuditRedactionService();
    const snapshot = service.redactSnapshot('user', {
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
      identity: { email: 'p***@example.test' },
      metadata: { mfa_enabled: '[REDACTED]' },
    });
    expect(JSON.stringify(snapshot)).not.toContain('must-not-appear');
    expect(JSON.stringify(snapshot)).not.toContain('registered-hash');
    for (const value of Object.values(secrets))
      expect(JSON.stringify(snapshot)).not.toContain(value);
  });

  it('prevents sensitive values from entering diffs', () => {
    const service = new AuditRedactionService();
    const diff = service.redactDiff(
      'profile',
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

    expect(diff.after).toMatchObject({
      phone: '[CHANGED]',
      address: '[CHANGED]',
      date_of_birth: '[CHANGED]',
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

  it('is recursive, cycle-safe, deterministic, and handles dates, relations, arrays, and buffers', () => {
    const service = new AuditRedactionService({ maxArrayLength: 2 });
    const role = { name: 'reader', id: 'role-1', secret: 'role-secret' };
    const entity: Record<string, unknown> = {
      updated_at: new Date('2026-01-02T03:04:05.000Z'),
      roles: [role, { id: 'role-2', name: 'writer' }, { id: 'role-3' }],
      id: 'user-1',
      profile: Buffer.from('raw bytes'),
    };
    role['users' as keyof typeof role] = entity as never;

    const first = service.redactSnapshot('user', entity);
    const second = service.redactSnapshot('user', entity);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toMatchObject({
      id: 'user-1',
      roles: [
        { id: 'role-1', name: 'reader' },
        { id: 'role-2', name: 'writer' },
        '[TRUNCATED]',
      ],
      updated_at: '2026-01-02T03:04:05.000Z',
    });
    expect(JSON.stringify(first)).not.toContain('role-secret');
  });

  it('replaces oversized output with a deterministic marker', () => {
    const service = new AuditRedactionService({ maxBytes: 20 });
    expect(
      service.redactSnapshot('image', {
        id: 'image-1',
        filename: 'a'.repeat(100),
      }),
    ).toEqual({ truncated: '[TRUNCATED]' });
  });
});
