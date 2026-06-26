import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1782509199150 implements MigrationInterface {
  name = 'Migration1782509199150';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`countries\` ADD \`flag_url\` varchar(255) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`countries\` DROP COLUMN \`flag_url\``,
    );
  }
}
