import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1791553408161 implements MigrationInterface {
  name = 'Migration1791553408161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`images\` ADD \`decorative\` tinyint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`articles\` ADD \`version\` int UNSIGNED NOT NULL DEFAULT '1'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`articles\` DROP COLUMN \`version\``);
    await queryRunner.query(
      `ALTER TABLE \`images\` DROP COLUMN \`decorative\``,
    );
  }
}
