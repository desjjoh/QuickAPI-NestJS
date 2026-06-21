import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1782077103372 implements MigrationInterface {
  name = 'Migration1782077103372';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_08a1cb4b6b3d42f8d26d03cd79\` ON \`user_phones\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_08a1cb4b6b3d42f8d26d03cd79\` ON \`user_phones\` (\`profile_id\`)`,
    );
  }
}
