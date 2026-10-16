import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AuditIdempotencyKey1792108800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'activity_audits',
      new TableColumn({
        name: 'idempotency_key',
        type: 'varchar',
        length: '128',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('activity_audits', 'idempotency_key');
  }
}
