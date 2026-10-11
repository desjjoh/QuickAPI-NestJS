import { isUserDeleted } from './user-deletion.policy';

describe('user deletion state', () => {
  it('uses the deleted status even without a timestamp or special name', () => {
    expect(isUserDeleted({ status: { key: 'deleted' } })).toBe(true);
  });

  it('never infers deletion from a name or timestamp', () => {
    const user = {
      status: { key: 'active' },
      metadata: { deleted_at: new Date() },
      name: 'Deleted user',
    };
    expect(isUserDeleted(user)).toBe(false);
  });

  it.each(['active', 'disabled', 'locked'])(
    'does not treat %s as deleted',
    (key) => {
      expect(isUserDeleted({ status: { key } })).toBe(false);
    },
  );
});
