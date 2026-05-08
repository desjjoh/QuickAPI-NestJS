import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1778262398867 implements MigrationInterface {
  name = 'Migration1778262398867';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`countries\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`iso2\` char(2) NOT NULL, \`iso3\` char(3) NOT NULL, \`calling_code\` varchar(8) NOT NULL, UNIQUE INDEX \`IDX_a318337c8cc3824514d3dfe2a6\` (\`key\`), UNIQUE INDEX \`IDX_9706e3c52695ce44a202f24c26\` (\`iso2\`), UNIQUE INDEX \`IDX_b29f9172f8b660e7834000c424\` (\`iso3\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`genders\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, UNIQUE INDEX \`IDX_39523689c025976b5c89521ab0\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`images\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`url\` varchar(255) NOT NULL, \`storage_key\` varchar(255) NOT NULL, \`filename\` varchar(255) NOT NULL, \`mime_type\` varchar(128) NOT NULL, \`size_bytes\` int NOT NULL, \`width\` int NOT NULL, \`height\` int NOT NULL, \`alt_text\` varchar(255) NULL, INDEX \`IDX_2425fcf752ffcac4e4e8f90ccf\` (\`storage_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`profile_addresses\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`address_line_1\` text NOT NULL, \`address_line_2\` text NULL, \`city\` text NOT NULL, \`region\` text NOT NULL, \`postal_code\` text NOT NULL, \`country_id\` varchar(16) NOT NULL, \`profile_id\` varchar(16) NOT NULL, UNIQUE INDEX \`REL_56b42e153434fec87f1a7b2730\` (\`profile_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_profiles\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`avatar_id\` varchar(16) NULL, \`gender_id\` varchar(16) NOT NULL, \`first\` text NOT NULL, \`last\` text NOT NULL, \`preferred\` text NULL, \`dob\` date NOT NULL, \`alternate_phone_e164\` varchar(20) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_credentials\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`refresh\` text NULL, \`token_version\` int NOT NULL DEFAULT '0', PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`credentials_id\` varchar(16) NULL, \`profile_id\` varchar(16) NOT NULL, \`email\` varchar(254) NOT NULL, \`phone_e164\` varchar(20) NULL, \`password\` text NULL, UNIQUE INDEX \`REL_caed45fe7b9ee802ffa015c300\` (\`credentials_id\`), UNIQUE INDEX \`REL_23371445bd80cb3e413089551b\` (\`profile_id\`), INDEX \`IDX_4263ae397e23dff35b72ddfd34\` (\`phone_e164\`), UNIQUE INDEX \`UQ_97672ac88f789774dd47f7c8be3\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`roles\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`description\` text NULL, UNIQUE INDEX \`IDX_a87cf0659c3ac379b339acf36a\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`permissions\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`key\` varchar(64) NOT NULL, \`label\` text NOT NULL, \`description\` text NULL, UNIQUE INDEX \`IDX_017943867ed5ceef9c03edd974\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_roles\` (\`user_id\` varchar(16) NOT NULL, \`role_id\` varchar(16) NOT NULL, INDEX \`IDX_87b8888186ca9769c960e92687\` (\`user_id\`), INDEX \`IDX_b23c65e50a758245a33ee35fda\` (\`role_id\`), PRIMARY KEY (\`user_id\`, \`role_id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`role_permissions\` (\`role_id\` varchar(16) NOT NULL, \`permission_id\` varchar(16) NOT NULL, INDEX \`IDX_178199805b901ccd220ab7740e\` (\`role_id\`), INDEX \`IDX_17022daf3f885f7d35423e9971\` (\`permission_id\`), PRIMARY KEY (\`role_id\`, \`permission_id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` ADD CONSTRAINT \`FK_9713871a604cf293846c87eeabf\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` ADD CONSTRAINT \`FK_56b42e153434fec87f1a7b27305\` FOREIGN KEY (\`profile_id\`) REFERENCES \`user_profiles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_9f50920867e4a3d29eec4c74bd4\` FOREIGN KEY (\`avatar_id\`) REFERENCES \`images\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_921e13ecb7520b5bdfc419638fe\` FOREIGN KEY (\`gender_id\`) REFERENCES \`genders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_caed45fe7b9ee802ffa015c300f\` FOREIGN KEY (\`credentials_id\`) REFERENCES \`user_credentials\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_23371445bd80cb3e413089551bf\` FOREIGN KEY (\`profile_id\`) REFERENCES \`user_profiles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_87b8888186ca9769c960e926870\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_b23c65e50a758245a33ee35fda1\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_178199805b901ccd220ab7740ec\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_17022daf3f885f7d35423e9971e\` FOREIGN KEY (\`permission_id\`) REFERENCES \`permissions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_17022daf3f885f7d35423e9971e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_178199805b901ccd220ab7740ec\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_b23c65e50a758245a33ee35fda1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_87b8888186ca9769c960e926870\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_23371445bd80cb3e413089551bf\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_caed45fe7b9ee802ffa015c300f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_921e13ecb7520b5bdfc419638fe\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_9f50920867e4a3d29eec4c74bd4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` DROP FOREIGN KEY \`FK_56b42e153434fec87f1a7b27305\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_addresses\` DROP FOREIGN KEY \`FK_9713871a604cf293846c87eeabf\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_17022daf3f885f7d35423e9971\` ON \`role_permissions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_178199805b901ccd220ab7740e\` ON \`role_permissions\``,
    );
    await queryRunner.query(`DROP TABLE \`role_permissions\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_b23c65e50a758245a33ee35fda\` ON \`user_roles\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_87b8888186ca9769c960e92687\` ON \`user_roles\``,
    );
    await queryRunner.query(`DROP TABLE \`user_roles\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_017943867ed5ceef9c03edd974\` ON \`permissions\``,
    );
    await queryRunner.query(`DROP TABLE \`permissions\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_a87cf0659c3ac379b339acf36a\` ON \`roles\``,
    );
    await queryRunner.query(`DROP TABLE \`roles\``);
    await queryRunner.query(
      `DROP INDEX \`UQ_97672ac88f789774dd47f7c8be3\` ON \`users\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_4263ae397e23dff35b72ddfd34\` ON \`users\``,
    );
    await queryRunner.query(
      `DROP INDEX \`REL_23371445bd80cb3e413089551b\` ON \`users\``,
    );
    await queryRunner.query(
      `DROP INDEX \`REL_caed45fe7b9ee802ffa015c300\` ON \`users\``,
    );
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(`DROP TABLE \`user_credentials\``);
    await queryRunner.query(`DROP TABLE \`user_profiles\``);
    await queryRunner.query(
      `DROP INDEX \`REL_56b42e153434fec87f1a7b2730\` ON \`profile_addresses\``,
    );
    await queryRunner.query(`DROP TABLE \`profile_addresses\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_2425fcf752ffcac4e4e8f90ccf\` ON \`images\``,
    );
    await queryRunner.query(`DROP TABLE \`images\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_39523689c025976b5c89521ab0\` ON \`genders\``,
    );
    await queryRunner.query(`DROP TABLE \`genders\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_b29f9172f8b660e7834000c424\` ON \`countries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_9706e3c52695ce44a202f24c26\` ON \`countries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_a318337c8cc3824514d3dfe2a6\` ON \`countries\``,
    );
    await queryRunner.query(`DROP TABLE \`countries\``);
  }
}
