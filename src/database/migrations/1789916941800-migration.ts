import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1789916941800 implements MigrationInterface {
  name = 'Migration1789916941800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_outcome\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`error\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`failure_code\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`failure_reason\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`outcome\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`outcome\` varchar(32) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`failure_reason\` varchar(512) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`failure_code\` varchar(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`error\` json NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_outcome\` ON \`activity_audits\` (\`outcome\`)`,
    );
  }
}
