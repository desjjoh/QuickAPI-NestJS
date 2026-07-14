import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1783996273165 implements MigrationInterface {
  name = 'Migration1783996273165';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`browser\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`device\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`os\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`ip_address\` varchar(45) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` ADD \`user_agent\` text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`user_agent\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`ip_address\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`os\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`device\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_credentials\` DROP COLUMN \`browser\``,
    );
  }
}
