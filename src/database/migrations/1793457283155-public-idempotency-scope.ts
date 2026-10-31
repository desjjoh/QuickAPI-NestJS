import { MigrationInterface, QueryRunner } from 'typeorm';

export class PublicIdempotencyScope1793457283155 implements MigrationInterface {
  public readonly name = 'PublicIdempotencyScope1793457283155';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `request_idempotency` MODIFY `actor_id` varchar(128) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ count: string | number }> = await queryRunner.query(
      'SELECT COUNT(*) AS count FROM `request_idempotency` WHERE `actor_id` IS NULL',
    );

    if (Number(rows[0].count) > 0)
      throw new Error(
        'Cannot revert while public idempotency records exist. Allow retention to expire and purge them before retrying.',
      );

    await queryRunner.query(
      'ALTER TABLE `request_idempotency` MODIFY `actor_id` varchar(128) NOT NULL',
    );
  }
}
