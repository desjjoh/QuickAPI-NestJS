import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1779534101057 implements MigrationInterface {
  name = 'Migration1779534101057';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`images\` DROP COLUMN \`url\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`images\` ADD \`url\` varchar(255) NOT NULL`,
    );
  }
}
