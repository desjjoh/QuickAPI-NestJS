import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1785539509612 implements MigrationInterface {
  name = 'Migration1785539509612';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_activity_audits_event_operation\` ON \`activity_audits\` (\`event\`, \`operation_id\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`UQ_activity_audits_event_operation\` ON \`activity_audits\``,
    );
  }
}
