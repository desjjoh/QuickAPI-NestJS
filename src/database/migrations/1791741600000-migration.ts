import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UserTombstones1791741600000 implements MigrationInterface {
  public async up(runner: QueryRunner): Promise<void> {
    // UserEntity.metadata.deleted_at is embedded with prefix:false, like the
    // other metadata fields; its SQL column remains on the users table.
    await runner.addColumn(
      'users',
      new TableColumn({
        name: 'deleted_at',
        type: 'datetime',
        precision: 3,
        isNullable: true,
      }),
    );
    await runner.query(
      "INSERT INTO `account_statuses` (`id`, `key`, `label`, `description`) SELECT LEFT(REPLACE(UUID(), '-', ''), 16), 'deleted', 'Deleted', 'The account is permanently soft deleted and cannot authenticate or be reactivated.' WHERE NOT EXISTS (SELECT 1 FROM `account_statuses` WHERE `key` = 'deleted')",
    );
  }

  public async down(runner: QueryRunner): Promise<void> {
    const rows: Array<{ count: string }> = await runner.query(
      "SELECT COUNT(*) AS count FROM `users` u JOIN `account_statuses` s ON s.id = u.status_id WHERE s.`key` = 'deleted'",
    );
    if (Number(rows[0].count) > 0)
      throw new Error(
        'Cannot revert soft deletion while deleted user records exist.',
      );
    await runner.dropColumn('users', 'deleted_at');
    await runner.query(
      "DELETE FROM `account_statuses` WHERE `key` = 'deleted'",
    );
  }
}
