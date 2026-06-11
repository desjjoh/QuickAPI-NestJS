import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1781144691900 implements MigrationInterface {
  name = 'Migration1781144691900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_4263ae397e23dff35b72ddfd34\` ON \`users\``,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_phones\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`phone_calling_code\` varchar(8) NOT NULL, \`phone_national_number\` varchar(20) NOT NULL, \`phone_e164\` varchar(20) NOT NULL, \`phone_country_id\` varchar(16) NOT NULL, \`user_id\` varchar(16) NOT NULL, INDEX \`IDX_b56470c89ee26f6d89f30e4e49\` (\`phone_country_id\`), INDEX \`IDX_0990202281d58188c350423042\` (\`phone_e164\`), UNIQUE INDEX \`REL_96bd55026671b792bb3ce699ff\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`profile_alternate_phones\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`phone_calling_code\` varchar(8) NOT NULL, \`phone_national_number\` varchar(20) NOT NULL, \`phone_e164\` varchar(20) NOT NULL, \`phone_country_id\` varchar(16) NOT NULL, \`profile_id\` varchar(16) NOT NULL, INDEX \`IDX_36c62a0b8f8026bd7cf2b65c43\` (\`phone_country_id\`), INDEX \`IDX_7cfbc13ffcf6beb8be7ef6811b\` (\`phone_e164\`), UNIQUE INDEX \`REL_7f3200c7ab04f4accb93bfc969\` (\`profile_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` DROP COLUMN \`alternate_phone_e164\``,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`phone_e164\``);
    await queryRunner.query(
      `ALTER TABLE \`user_phones\` ADD CONSTRAINT \`FK_b56470c89ee26f6d89f30e4e498\` FOREIGN KEY (\`phone_country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_phones\` ADD CONSTRAINT \`FK_96bd55026671b792bb3ce699ffd\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_alternate_phones\` ADD CONSTRAINT \`FK_36c62a0b8f8026bd7cf2b65c432\` FOREIGN KEY (\`phone_country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_alternate_phones\` ADD CONSTRAINT \`FK_7f3200c7ab04f4accb93bfc9696\` FOREIGN KEY (\`profile_id\`) REFERENCES \`user_profiles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`profile_alternate_phones\` DROP FOREIGN KEY \`FK_7f3200c7ab04f4accb93bfc9696\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profile_alternate_phones\` DROP FOREIGN KEY \`FK_36c62a0b8f8026bd7cf2b65c432\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_phones\` DROP FOREIGN KEY \`FK_96bd55026671b792bb3ce699ffd\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_phones\` DROP FOREIGN KEY \`FK_b56470c89ee26f6d89f30e4e498\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`phone_e164\` varchar(20) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_profiles\` ADD \`alternate_phone_e164\` varchar(20) NULL`,
    );
    await queryRunner.query(
      `DROP INDEX \`REL_7f3200c7ab04f4accb93bfc969\` ON \`profile_alternate_phones\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7cfbc13ffcf6beb8be7ef6811b\` ON \`profile_alternate_phones\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_36c62a0b8f8026bd7cf2b65c43\` ON \`profile_alternate_phones\``,
    );
    await queryRunner.query(`DROP TABLE \`profile_alternate_phones\``);
    await queryRunner.query(
      `DROP INDEX \`REL_96bd55026671b792bb3ce699ff\` ON \`user_phones\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_0990202281d58188c350423042\` ON \`user_phones\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_b56470c89ee26f6d89f30e4e49\` ON \`user_phones\``,
    );
    await queryRunner.query(`DROP TABLE \`user_phones\``);
    await queryRunner.query(
      `CREATE INDEX \`IDX_4263ae397e23dff35b72ddfd34\` ON \`users\` (\`phone_e164\`)`,
    );
  }
}
