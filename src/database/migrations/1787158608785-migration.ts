import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1787158608785 implements MigrationInterface {
  name = 'Migration1787158608785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_idempotency_id\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`UQ_activity_audits_event_operation\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`idempotency_id\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`idempotency_id\` varchar(128) NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_activity_audits_event_operation\` ON \`activity_audits\` (\`event\`, \`operation_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_idempotency_id\` ON \`activity_audits\` (\`idempotency_id\`)`,
    );
  }
}
