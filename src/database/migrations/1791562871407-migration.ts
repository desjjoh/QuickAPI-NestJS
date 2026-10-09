import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1791562871407 implements MigrationInterface {
  name = 'Migration1791562871407';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX \`IDX_articles_review_listing\` ON \`articles\` (\`status_id\`, \`createdAt\`, \`id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_articles_creator_listing\` ON \`articles\` (\`author_id\`, \`createdAt\`, \`id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_articles_public_listing\` ON \`articles\` (\`status_id\`, \`publishedAt\`, \`id\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_articles_public_listing\` ON \`articles\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_articles_creator_listing\` ON \`articles\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_articles_review_listing\` ON \`articles\``,
    );
  }
}
