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
    const listingIndexes = [
      'IDX_articles_public_listing',
      'IDX_articles_creator_listing',
      'IDX_articles_review_listing',
    ];
    const indexes: Array<{
      Key_name: string;
      Column_name: string;
      Seq_in_index: number;
    }> = await queryRunner.query('SHOW INDEX FROM `articles`');

    // InnoDB may discard implicit FK indexes when a composite index replaces them.
    // Restore a supporting index before removing any of the listing indexes.
    for (const [column, name] of [
      ['author_id', 'FK_6515da4dff8db423ce4eb841490'],
      ['status_id', 'FK_f2e59122c74687aa43ab8e59cc9'],
    ]) {
      const hasSurvivingIndex = indexes.some(
        (index) =>
          Number(index.Seq_in_index) === 1 &&
          index.Column_name === column &&
          !listingIndexes.includes(index.Key_name),
      );
      if (!hasSurvivingIndex) {
        await queryRunner.query(
          `CREATE INDEX \`${name}\` ON \`articles\` (\`${column}\`)`,
        );
      }
    }

    // MySQL DDL implicitly commits: a failed earlier revert may have dropped an
    // index despite its ROLLBACK. Skip missing indexes so the revert can resume.
    for (const name of listingIndexes) {
      if (indexes.some((index) => index.Key_name === name)) {
        await queryRunner.query(`DROP INDEX \`${name}\` ON \`articles\``);
      }
    }
  }
}
