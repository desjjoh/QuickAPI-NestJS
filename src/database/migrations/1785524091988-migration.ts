import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1785524091988 implements MigrationInterface {
  name = 'Migration1785524091988';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`UQ_97672ac88f789774dd47f7c8be3\` ON \`users\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`error\` json NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`error\``,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_97672ac88f789774dd47f7c8be3\` ON \`users\` (\`email\`)`,
    );
  }
}
