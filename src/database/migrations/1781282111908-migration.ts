import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1781282111908 implements MigrationInterface {
  name = 'Migration1781282111908';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` CHANGE \`region\` \`region_id\` text NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE \`country_regions\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`code\` varchar(16) NOT NULL, \`label\` text NOT NULL, \`country_id\` varchar(16) NOT NULL, UNIQUE INDEX \`IDX_8ef62f21aefd2db74ed5860ef1\` (\`country_id\`, \`code\`), UNIQUE INDEX \`IDX_b856bc22c6ec07eda24fb99927\` (\`country_id\`, \`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` ADD \`postal_code_placeholder\` varchar(32) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` ADD \`postal_code_pattern\` varchar(128) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` ADD \`postal_code_format_groups\` text NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` ADD \`postal_code_format_separator\` varchar(8) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` DROP COLUMN \`region_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` ADD \`region_id\` varchar(16) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`country_regions\` ADD CONSTRAINT \`FK_8719ea13b224a98a401bb241cfe\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` ADD CONSTRAINT \`FK_d30f5b77485b00ea7314fc3ec8c\` FOREIGN KEY (\`region_id\`) REFERENCES \`country_regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` DROP FOREIGN KEY \`FK_d30f5b77485b00ea7314fc3ec8c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`country_regions\` DROP FOREIGN KEY \`FK_8719ea13b224a98a401bb241cfe\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` DROP COLUMN \`region_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` ADD \`region_id\` text NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` DROP COLUMN \`postal_code_format_separator\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` DROP COLUMN \`postal_code_format_groups\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` DROP COLUMN \`postal_code_pattern\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`countries\` DROP COLUMN \`postal_code_placeholder\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_b856bc22c6ec07eda24fb99927\` ON \`country_regions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_8ef62f21aefd2db74ed5860ef1\` ON \`country_regions\``,
    );
    await queryRunner.query(`DROP TABLE \`country_regions\``);
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` CHANGE \`region_id\` \`region\` text NOT NULL`,
    );
  }
}
