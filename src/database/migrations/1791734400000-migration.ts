import { MigrationInterface, QueryRunner } from 'typeorm';

export class StorageObjectTracking1791734400000 implements MigrationInterface {
  public async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE \`storage_objects\` (
      \`storage_key\` varchar(255) NOT NULL,
      \`state\` varchar(16) NOT NULL,
      \`created_at\` datetime(3) NOT NULL,
      \`expires_at\` datetime(3) NULL,
      PRIMARY KEY (\`storage_key\`),
      INDEX \`IDX_storage_objects_reconcile\` (\`state\`, \`expires_at\`)
    ) ENGINE=InnoDB`);
    await runner.query(`INSERT IGNORE INTO \`storage_objects\` (\`storage_key\`, \`state\`, \`created_at\`, \`expires_at\`)
      SELECT \`storage_key\`, 'attached', CURRENT_TIMESTAMP(3), NULL FROM \`images\``);
    await runner.query(`INSERT IGNORE INTO \`storage_objects\` (\`storage_key\`, \`state\`, \`created_at\`, \`expires_at\`)
      SELECT \`storage_key\`, 'attached', CURRENT_TIMESTAMP(3), NULL FROM \`storage_deletion_intents\`
      WHERE CHAR_LENGTH(\`storage_key\`) <= 255`);
  }
  public async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE `storage_objects`');
  }
}
