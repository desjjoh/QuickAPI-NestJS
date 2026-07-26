import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1785037010153 implements MigrationInterface {
  name = 'Migration1785037010153';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` ADD \`failed_attempts\` int UNSIGNED NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` ADD \`locked_at\` datetime NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`registration_tokens\` ADD \`failed_attempts\` int UNSIGNED NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`registration_tokens\` ADD \`locked_at\` datetime NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`registration_tokens\` DROP COLUMN \`locked_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`registration_tokens\` DROP COLUMN \`failed_attempts\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` DROP COLUMN \`locked_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` DROP COLUMN \`failed_attempts\``,
    );
  }
}
