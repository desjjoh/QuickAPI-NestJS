import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAdministrationVersion1791723600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD `administration_version` int UNSIGNED NOT NULL DEFAULT 1',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `administration_version`',
    );
  }
}
