import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1784608809570 implements MigrationInterface {
  name = 'Migration1784608809570';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`country_code\` varchar(2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`country_name\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`region_code\` varchar(16) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`region_name\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`city\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`source\` varchar(16) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`resolved_at\` datetime NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`resolved_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`source\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`city\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`region_name\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`region_code\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`country_name\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`country_code\``,
    );
  }
}
