import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1791556334447 implements MigrationInterface {
  name = 'Migration1791556334447';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`request_idempotency\` (\`scope_hash\` char(64) NOT NULL, \`actor_id\` varchar(128) NOT NULL, \`operation\` varchar(128) NOT NULL, \`route\` varchar(512) NOT NULL, \`fingerprint\` char(64) NOT NULL, \`state\` varchar(16) NOT NULL, \`response_status\` int NULL, \`response_body\` json NULL, \`response_identity\` varchar(128) NULL, \`expires_at\` datetime(3) NOT NULL, INDEX \`IDX_idempotency_expiry\` (\`expires_at\`), PRIMARY KEY (\`scope_hash\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_idempotency_expiry\` ON \`request_idempotency\``,
    );
    await queryRunner.query(`DROP TABLE \`request_idempotency\``);
  }
}
