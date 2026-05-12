import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1778554544826 implements MigrationInterface {
  name = 'Migration1778554544826';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`UQ_97672ac88f789774dd47f7c8be3\` ON \`users\``,
    );
    await queryRunner.query(
      `CREATE TABLE \`account_tokens\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`type\` enum ('email_verification', 'password_reset') NOT NULL, \`token_hash\` varchar(128) NOT NULL, \`expires_at\` datetime NOT NULL, \`consumed_at\` datetime NULL, \`user_id\` varchar(16) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` ADD CONSTRAINT \`FK_1b5fea09efc20c7f63c4a09b3d6\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` DROP FOREIGN KEY \`FK_1b5fea09efc20c7f63c4a09b3d6\``,
    );
    await queryRunner.query(`DROP TABLE \`account_tokens\``);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_97672ac88f789774dd47f7c8be3\` ON \`users\` (\`email\`)`,
    );
  }
}
