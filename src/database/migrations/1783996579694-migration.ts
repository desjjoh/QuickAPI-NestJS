import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1783996579694 implements MigrationInterface {
  name = 'Migration1783996579694';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`browser_version\` varchar(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`os_version\` varchar(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`origin\` varchar(2048) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`referrer\` varchar(2048) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`referrer\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`origin\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`os_version\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`browser_version\``,
    );
  }
}
