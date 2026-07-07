import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1783436913503 implements MigrationInterface {
  name = 'Migration1783436913503';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`last_updated_at\` datetime NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`last_updated_at\``,
    );
  }
}
