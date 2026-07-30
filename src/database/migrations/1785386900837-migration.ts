import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1785386900837 implements MigrationInterface {
  name = 'Migration1785386900837';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`activity_audits\` (\`id\` varchar(16) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`category\` varchar(32) NOT NULL, \`event\` varchar(128) NOT NULL, \`outcome\` varchar(32) NOT NULL, \`actor_type\` varchar(32) NOT NULL, \`actor_user_id\` varchar(16) NULL, \`subject_user_id\` varchar(16) NULL, \`entity_type\` varchar(64) NULL, \`entity_id\` varchar(64) NULL, \`request_id\` varchar(64) NULL, \`session_id\` varchar(16) NULL, \`ip_address\` varchar(45) NULL, \`user_agent\` varchar(512) NULL, \`http_method\` varchar(16) NULL, \`route\` varchar(512) NULL, \`failure_reason\` varchar(512) NULL, \`failure_code\` varchar(64) NULL, \`source\` varchar(32) NOT NULL, \`occurred_at\` datetime(6) NOT NULL, \`before\` json NULL, \`after\` json NULL, \`changes\` json NULL, \`metadata\` json NULL, INDEX \`IDX_177161f759755a370555c3b477\` (\`category\`), INDEX \`IDX_5fb416c31da77206b8f09f363f\` (\`event\`), INDEX \`IDX_d9992c2f581bf2248aedd63f78\` (\`outcome\`), INDEX \`IDX_14d1f66112d821cdcbb6dc1677\` (\`actor_type\`), INDEX \`IDX_7339691bd1c0ca6fd0d2a6b82c\` (\`actor_user_id\`), INDEX \`IDX_f0a1c9bbe69383bb52b65073ff\` (\`subject_user_id\`), INDEX \`IDX_e51c29fa1c2b3536c36b962d79\` (\`entity_type\`), INDEX \`IDX_7114ce3f8b57c1b426031f0131\` (\`entity_id\`), INDEX \`IDX_7c91d72161a9b4944dcbd692ef\` (\`request_id\`), INDEX \`IDX_c9e7ca8bbf8ac44cf3ac74ca25\` (\`session_id\`), INDEX \`IDX_0eb2a781d6df8e4ea5f9a92d38\` (\`source\`), INDEX \`IDX_activity_audits_occurred_at\` (\`occurred_at\`), INDEX \`IDX_activity_audits_event_time\` (\`event\`, \`occurred_at\`), INDEX \`IDX_activity_audits_entity_time\` (\`entity_type\`, \`entity_id\`, \`occurred_at\`), INDEX \`IDX_activity_audits_subject_time\` (\`subject_user_id\`, \`occurred_at\`), INDEX \`IDX_activity_audits_actor_time\` (\`actor_user_id\`, \`occurred_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_actor_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_subject_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_entity_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_event_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_occurred_at\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_0eb2a781d6df8e4ea5f9a92d38\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_c9e7ca8bbf8ac44cf3ac74ca25\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7c91d72161a9b4944dcbd692ef\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7114ce3f8b57c1b426031f0131\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_e51c29fa1c2b3536c36b962d79\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_f0a1c9bbe69383bb52b65073ff\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7339691bd1c0ca6fd0d2a6b82c\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_14d1f66112d821cdcbb6dc1677\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_d9992c2f581bf2248aedd63f78\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_5fb416c31da77206b8f09f363f\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_177161f759755a370555c3b477\` ON \`activity_audits\``,
    );
    await queryRunner.query(`DROP TABLE \`activity_audits\``);
  }
}
