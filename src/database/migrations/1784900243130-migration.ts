import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1784900243130 implements MigrationInterface {
  name = 'Migration1784900243130';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`mfa_enabled\` tinyint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`mfa_enabled\``,
    );
  }
}
