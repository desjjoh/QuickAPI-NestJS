import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1782669429957 implements MigrationInterface {
  name = 'Migration1782669429957';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`timezones\` DROP COLUMN \`short_name\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`timezones\` DROP COLUMN \`offset_minutes\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`timezones\` DROP COLUMN \`offset_label\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`timezones\` ADD \`offset_label\` varchar(16) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`timezones\` ADD \`offset_minutes\` smallint NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`timezones\` ADD \`short_name\` varchar(32) NOT NULL`,
    );
  }
}
