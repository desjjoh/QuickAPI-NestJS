import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1784774887932 implements MigrationInterface {
  name = 'Migration1784774887932';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_caed45fe7b9ee802ffa015c300f\``,
    );
    await queryRunner.query(
      `DROP INDEX \`REL_caed45fe7b9ee802ffa015c300\` ON \`users\``,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_sessions\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`refresh\` text NULL, \`token_version\` int NOT NULL DEFAULT '0', \`active\` tinyint NOT NULL DEFAULT 1, \`browser\` varchar(255) NULL, \`browser_version\` varchar(64) NULL, \`device\` varchar(255) NULL, \`os\` varchar(255) NULL, \`os_version\` varchar(64) NULL, \`ip_address\` varchar(45) NULL, \`user_agent\` text NULL, \`origin\` varchar(2048) NULL, \`userId\` varchar(16) NOT NULL, \`country_code\` varchar(2) NULL, \`country_name\` varchar(255) NULL, \`region_code\` varchar(16) NULL, \`region_name\` varchar(255) NULL, \`city\` varchar(255) NULL, \`source\` varchar(16) NULL, \`resolved_at\` datetime NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`credentials_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_sessions\` ADD CONSTRAINT \`FK_55fa4db8406ed66bc7044328427\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_sessions\` DROP FOREIGN KEY \`FK_55fa4db8406ed66bc7044328427\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`credentials_id\` varchar(16) NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE \`user_sessions\``);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`REL_caed45fe7b9ee802ffa015c300\` ON \`users\` (\`credentials_id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_caed45fe7b9ee802ffa015c300f\` FOREIGN KEY (\`credentials_id\`) REFERENCES \`user_credentials\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
