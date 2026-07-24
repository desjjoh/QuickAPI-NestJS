import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1784896287218 implements MigrationInterface {
  name = 'Migration1784896287218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`user_mfa_settings\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`enabled\` tinyint NOT NULL DEFAULT 0, \`primary_method\` enum ('email_otp') NOT NULL DEFAULT 'email_otp', \`enabled_at\` datetime NULL, \`disabled_at\` datetime NULL, \`last_verified_at\` datetime NULL, \`user_id\` varchar(16) NOT NULL, UNIQUE INDEX \`REL_15e9b906c2a4b7bf3870a1b499\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` CHANGE \`type\` \`type\` enum ('email_verification', 'password_reset', 'email_change', 'email_mfa') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_mfa_settings\` ADD CONSTRAINT \`FK_15e9b906c2a4b7bf3870a1b4994\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_mfa_settings\` DROP FOREIGN KEY \`FK_15e9b906c2a4b7bf3870a1b4994\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` CHANGE \`type\` \`type\` enum ('email_verification', 'password_reset', 'email_change') NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX \`REL_15e9b906c2a4b7bf3870a1b499\` ON \`user_mfa_settings\``,
    );
    await queryRunner.query(`DROP TABLE \`user_mfa_settings\``);
  }
}
