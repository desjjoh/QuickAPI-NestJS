import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1785436468092 implements MigrationInterface {
  name = 'Migration1785436468092';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_0eb2a781d6df8e4ea5f9a92d38\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_14d1f66112d821cdcbb6dc1677\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_177161f759755a370555c3b477\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_5fb416c31da77206b8f09f363f\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7114ce3f8b57c1b426031f0131\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7339691bd1c0ca6fd0d2a6b82c\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7c91d72161a9b4944dcbd692ef\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_actor_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_entity_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_event_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_subject_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_c9e7ca8bbf8ac44cf3ac74ca25\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_d9992c2f581bf2248aedd63f78\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_e51c29fa1c2b3536c36b962d79\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_f0a1c9bbe69383bb52b65073ff\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`actor_user_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`subject_user_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`entity_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`entity_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`actor_id\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`subject_type\` varchar(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`subject_id\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`resource_type\` varchar(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`resource_id\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`domain\` varchar(64) NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_request_id\` ON \`activity_audits\` (\`request_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_session_id\` ON \`activity_audits\` (\`session_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_domain_event_time\` ON \`activity_audits\` (\`domain\`, \`event\`, \`occurred_at\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_resource_time\` ON \`activity_audits\` (\`resource_type\`, \`resource_id\`, \`occurred_at\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_subject_time\` ON \`activity_audits\` (\`subject_type\`, \`subject_id\`, \`occurred_at\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_actor_time\` ON \`activity_audits\` (\`actor_type\`, \`actor_id\`, \`occurred_at\`)`,
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
      `DROP INDEX \`IDX_activity_audits_resource_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_domain_event_time\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_session_id\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_audits_request_id\` ON \`activity_audits\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`domain\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`resource_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`resource_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`subject_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`subject_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` DROP COLUMN \`actor_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`entity_id\` varchar(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`entity_type\` varchar(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`subject_user_id\` varchar(16) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_audits\` ADD \`actor_user_id\` varchar(16) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_f0a1c9bbe69383bb52b65073ff\` ON \`activity_audits\` (\`subject_user_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_e51c29fa1c2b3536c36b962d79\` ON \`activity_audits\` (\`entity_type\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_d9992c2f581bf2248aedd63f78\` ON \`activity_audits\` (\`outcome\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_c9e7ca8bbf8ac44cf3ac74ca25\` ON \`activity_audits\` (\`session_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_subject_time\` ON \`activity_audits\` (\`subject_user_id\`, \`occurred_at\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_event_time\` ON \`activity_audits\` (\`event\`, \`occurred_at\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_entity_time\` ON \`activity_audits\` (\`entity_type\`, \`entity_id\`, \`occurred_at\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_activity_audits_actor_time\` ON \`activity_audits\` (\`actor_user_id\`, \`occurred_at\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_7c91d72161a9b4944dcbd692ef\` ON \`activity_audits\` (\`request_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_7339691bd1c0ca6fd0d2a6b82c\` ON \`activity_audits\` (\`actor_user_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_7114ce3f8b57c1b426031f0131\` ON \`activity_audits\` (\`entity_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_5fb416c31da77206b8f09f363f\` ON \`activity_audits\` (\`event\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_177161f759755a370555c3b477\` ON \`activity_audits\` (\`category\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_14d1f66112d821cdcbb6dc1677\` ON \`activity_audits\` (\`actor_type\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_0eb2a781d6df8e4ea5f9a92d38\` ON \`activity_audits\` (\`source\`)`,
    );
  }
}
