import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AuditActorUsers1791745200000 implements MigrationInterface {
  public async up(runner: QueryRunner): Promise<void> {
    await runner.addColumn(
      'activity_audits',
      new TableColumn({
        name: 'actor_user_id',
        type: 'varchar',
        length: '16',
        isNullable: true,
      }),
    );
    await runner.createIndex(
      'activity_audits',
      new TableIndex({
        name: 'IDX_activity_audits_actor_user',
        columnNames: ['actor_user_id'],
      }),
    );
    await runner.createForeignKey(
      'activity_audits',
      new TableForeignKey({
        name: 'FK_activity_audits_actor_user',
        columnNames: ['actor_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'RESTRICT',
      }),
    );
    // Only actors that really represent an existing user may be linked.
    await runner.query(
      "UPDATE `activity_audits` a INNER JOIN `users` u ON u.id = a.actor_id SET a.actor_user_id = u.id WHERE a.actor_type IN ('user', 'admin')",
    );
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.dropForeignKey(
      'activity_audits',
      'FK_activity_audits_actor_user',
    );
    await runner.dropIndex('activity_audits', 'IDX_activity_audits_actor_user');
    await runner.dropColumn('activity_audits', 'actor_user_id');
  }
}
