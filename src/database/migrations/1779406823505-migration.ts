import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1779406823505 implements MigrationInterface {
  name = 'Migration1779406823505';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`UQ_97672ac88f789774dd47f7c8be3\` ON \`users\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` ADD \`metadata\` json NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` CHANGE \`type\` \`type\` enum ('email_verification', 'password_reset', 'email_change') NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` CHANGE \`type\` \`type\` enum ('email_verification', 'password_reset') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`account_tokens\` DROP COLUMN \`metadata\``,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_97672ac88f789774dd47f7c8be3\` ON \`users\` (\`email\`)`,
    );
  }
}
