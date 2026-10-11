import { MigrationInterface, QueryRunner } from 'typeorm';

export class StorageDeletionIntents1791730800000 implements MigrationInterface {
  public async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE \`storage_deletion_intents\` (
      \`id\` varchar(36) NOT NULL,
      \`storage_key\` varchar(1024) NOT NULL,
      \`reason\` varchar(32) NOT NULL,
      \`request_id\` varchar(128) NULL,
      \`state\` varchar(16) NOT NULL,
      \`attempts\` int UNSIGNED NOT NULL DEFAULT 0,
      \`last_error\` varchar(128) NULL,
      \`dlq_forwarded\` tinyint NOT NULL DEFAULT 0,
      \`created_at\` datetime(3) NOT NULL,
      \`available_at\` datetime(3) NOT NULL,
      \`completed_at\` datetime(3) NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`IDX_storage_deletion_due\` (\`state\`, \`available_at\`)
    ) ENGINE=InnoDB`);
  }
  public async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE `storage_deletion_intents`');
  }
}
