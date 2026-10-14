import {
  AuditUserDto,
  type AuditUserRead,
} from '@/modules/domain/audit/models/audit-user.model';

const user: AuditUserRead = {
  id: 'actor-1',
  email: 'actor@example.test',
  first: 'Pat',
  last: 'Person',
  preferred: ' Reader ',
  status_key: 'active',
  status_label: 'Active',
  avatar_id: 'avatar-1',
  avatar_key: 'avatars/display.png',
};

describe('AuditUserDto', () => {
  it('only exposes display fields even when given a payload with sensitive extras', () => {
    const dto = new AuditUserDto({
      ...user,
      password: 'hash',
      roles: ['admin'],
      tokens: ['token'],
      phone: 'private',
    } as AuditUserRead);
    expect(Object.keys(dto).sort()).toEqual([
      'avatar',
      'email',
      'id',
      'name',
      'status',
    ]);
    expect(dto).toMatchObject({
      id: user.id,
      name: 'Reader',
      email: user.email,
      status: { key: 'active', label: 'Active' },
    });
    expect(Object.keys(dto.avatar!).sort()).toEqual(['id', 'url']);
    expect(dto.avatar!.url).toContain('avatars/display.png');
    expect(Object.isFrozen(dto)).toBe(true);
    expect(Object.isFrozen(dto.status)).toBe(true);
    expect(Object.isFrozen(dto.avatar)).toBe(true);
    expect(JSON.stringify(dto)).not.toMatch(
      /password|roles|tokens|phone|storage_key/,
    );
  });

  it('retains the internal tombstone email and uses status, not name, to hide the avatar', () => {
    const deleted = new AuditUserDto({
      ...user,
      preferred: null,
      status_key: 'deleted',
      status_label: 'Deleted',
      email: 'deleted-3c7e863c-2a36-4ff3-9e2d-d73fdcb7a003@users.invalid',
    });
    expect(deleted).toEqual({
      id: user.id,
      name: 'Pat Person',
      email: 'deleted-3c7e863c-2a36-4ff3-9e2d-d73fdcb7a003@users.invalid',
      avatar: null,
      status: { key: 'deleted', label: 'Deleted' },
    });
    expect(JSON.stringify(deleted)).not.toContain(user.email);
    const active = new AuditUserDto({
      ...user,
      preferred: 'Deleted User',
      avatar_id: null,
      avatar_key: null,
    });
    expect(active.email).toBe(user.email);
    expect(active.status.key).toBe('active');
    expect(active.avatar).toBeNull();
  });
});
