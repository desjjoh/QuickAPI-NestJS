import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1782434941284 implements MigrationInterface {
  name = 'Migration1782434941284';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD \`country_id\` varchar(16) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_08cebbf6264e68ce171deaf3e97\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_08cebbf6264e68ce171deaf3e97\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP COLUMN \`country_id\``,
    );
  }
}
