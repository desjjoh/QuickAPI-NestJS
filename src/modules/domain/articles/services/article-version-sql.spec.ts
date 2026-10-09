import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { ArticleEntity } from '../entities/article.entity';

/** Builds actual MySQL entity metadata without connecting to a database. */
class MetadataDataSource extends DataSource {
  public async prepareMetadata(): Promise<void> {
    await this.buildMetadatas();
  }
}

describe('article version SQL', () => {
  it('compiles a single conditional write with embedded lifecycle fields and null clearing', async () => {
    const source = new MetadataDataSource({
      type: 'mysql',
      database: 'metadata_only',
      entities: getMetadataArgsStorage()
        .tables.map((table) => table.target)
        .filter((target) => typeof target === 'function'),
    });
    await source.prepareMetadata();
    const [sql, parameters] = source
      .createQueryBuilder()
      .update(ArticleEntity)
      .set({
        content: { title: 'Updated' },
        publication: {
          status: { id: 'draft-status' },
          publisher: null,
          publishedAt: null,
        },
        version: () => '`version` + 1',
      })
      .where({ id: 'article-1', version: 3 })
      .getQueryAndParameters();
    expect(sql).toContain('`version` = `version` + 1');
    expect(sql).toContain('`publisher_id` = ?');
    expect(sql).toContain('`publishedAt` = ?');
    expect(sql).toContain('`status_id` = ?');
    expect(sql).toMatch(/WHERE.*`id` = \?.*`version` = \?/);
    expect(parameters).toEqual(
      expect.arrayContaining(['Updated', 'draft-status', null, 'article-1', 3]),
    );
    expect(source.isInitialized).toBe(false);
  });
});
