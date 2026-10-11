import { MigrationInterface, QueryRunner } from 'typeorm';

// Freeze this migration's catalog: future application enum additions must not
// silently change the schema produced by replaying a historical migration.
const CLASSIFICATIONS = [
  {
    column: 'actor_type',
    length: 32,
    nullable: false,
    values: ['user', 'anonymous', 'service', 'admin', 'system'],
  },
  {
    column: 'source',
    length: 32,
    nullable: false,
    values: [
      'http',
      'queue',
      'scheduled_job',
      'seed',
      'service',
      'migration',
      'system',
    ],
  },
  {
    column: 'domain',
    length: 64,
    nullable: false,
    values: ['identity', 'articles'],
  },
  {
    column: 'subject_type',
    length: 64,
    nullable: true,
    values: ['user', 'article'],
  },
  {
    column: 'resource_type',
    length: 64,
    nullable: true,
    values: [
      'identity.user',
      'identity.profile',
      'identity.phone',
      'identity.address',
      'identity.image',
      'identity.session',
      'identity.role',
      'identity.account_status',
      'media.image',
      'articles.article',
    ],
  },
] as const;

export class AuditClassificationEnums1791748800000
  implements MigrationInterface
{
  public async up(runner: QueryRunner): Promise<void> {
    const [mode]: Array<{ session_mode: string; global_mode: string }> =
      await runner.query(
        'SELECT @@SESSION.sql_mode AS session_mode, @@GLOBAL.sql_mode AS global_mode',
      );
    const strict = (value: string) =>
      value
        .split(',')
        .some((part) =>
          ['STRICT_TRANS_TABLES', 'STRICT_ALL_TABLES'].includes(part.trim()),
        );
    if (!strict(mode.session_mode) || !strict(mode.global_mode))
      throw new Error(
        'Audit classification enums require strict MySQL SQL mode for the migration session and application connections. Enable STRICT_TRANS_TABLES or STRICT_ALL_TABLES before retrying; no audit schema or rows have been changed.',
      );
    // Inventory every field before the first DDL statement. Compare exact
    // bytes so case/whitespace variants cannot be silently normalized or lost.
    for (const field of CLASSIFICATIONS) {
      const rows: Array<{ value: Buffer | string }> = await runner.query(
        `SELECT DISTINCT CAST(\`${field.column}\` AS BINARY) AS value FROM \`activity_audits\` WHERE \`${field.column}\` IS NOT NULL`,
      );
      const allowed: readonly string[] = field.values;
      const unknown = rows.filter(
        ({ value }) =>
          !allowed.includes(
            Buffer.isBuffer(value) ? value.toString('utf8') : value,
          ),
      );
      if (unknown.length)
        throw new Error(
          `Cannot convert activity_audits.${field.column}: ${unknown.length} unrecognized historical classification value(s). Review retained values and explicitly extend the migration catalog or resolve invalid data before retrying; no audit rows have been changed.`,
        );
    }
    // One ALTER preserves indexes and avoids a partially converted schema.
    await runner.query(
      `ALTER TABLE \`activity_audits\` ${CLASSIFICATIONS.map(
        (field) =>
          `MODIFY COLUMN \`${field.column}\` ENUM(${field.values.map((value) => `'${value}'`).join(',')}) ${field.nullable ? 'NULL' : 'NOT NULL'}`,
      ).join(', ')}`,
    );
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE \`activity_audits\` ${CLASSIFICATIONS.map(
        (field) =>
          `MODIFY COLUMN \`${field.column}\` varchar(${field.length}) ${field.nullable ? 'NULL' : 'NOT NULL'}`,
      ).join(', ')}`,
    );
  }
}
