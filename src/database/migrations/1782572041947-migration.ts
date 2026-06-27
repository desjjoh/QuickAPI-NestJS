import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1782572041947 implements MigrationInterface {
  name = 'Migration1782572041947';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`timezones\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`long_name\` varchar(64) NOT NULL, \`short_name\` varchar(32) NOT NULL, \`offset_minutes\` smallint NOT NULL, \`offset_label\` varchar(16) NOT NULL, \`region\` varchar(32) NOT NULL, \`exemplar_city\` varchar(64) NOT NULL, UNIQUE INDEX \`IDX_df44a14981c12b9b7aa3a799c9\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD \`timezone_id\` varchar(16) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_974e65f08b078104dde8d9850cf\` FOREIGN KEY (\`timezone_id\`) REFERENCES \`timezones\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_974e65f08b078104dde8d9850cf\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP COLUMN \`timezone_id\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_df44a14981c12b9b7aa3a799c9\` ON \`timezones\``,
    );
    await queryRunner.query(`DROP TABLE \`timezones\``);
  }
}
