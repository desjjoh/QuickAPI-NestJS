import { DataSource } from 'typeorm';
import applicationDataSource from '@/database/typeorm.datasource';
import { ArticleEntity } from './article.entity';

class MetadataSource extends DataSource {
  public inspectEntities(): Promise<void> {
    return this.buildMetadatas();
  }
}

describe('article listing indexes', () => {
  it('resolves embedded relation paths to the intended database columns without connecting', async () => {
    const source = new MetadataSource({
      ...applicationDataSource.options,
      migrations: [],
    });
    await source.inspectEntities();
    const indexes = source.getMetadata(ArticleEntity).indices;
    const columns = (name: string) =>
      indexes
        .find((index) => index.name === name)!
        .columns.map((column) => column.databaseName);
    expect(columns('IDX_articles_public_listing')).toEqual([
      'status_id',
      'publishedAt',
      'id',
    ]);
    expect(columns('IDX_articles_creator_listing')).toEqual([
      'author_id',
      'createdAt',
      'id',
    ]);
    expect(columns('IDX_articles_review_listing')).toEqual([
      'status_id',
      'createdAt',
      'id',
    ]);
  });
});
