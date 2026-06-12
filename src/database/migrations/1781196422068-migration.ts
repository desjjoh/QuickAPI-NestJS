import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1781196422068 implements MigrationInterface {
  name = 'Migration1781196422068';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`countries\` ADD \`phone_national_placeholder\` varchar(32) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` ADD \`phone_national_pattern\` varchar(128) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` ADD \`phone_format_groups\` text NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`countries\` DROP COLUMN \`phone_format_groups\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` DROP COLUMN \`phone_national_pattern\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` DROP COLUMN \`phone_national_placeholder\``,
    );
  }
}
