import { ArticleEntity } from '@/modules/domain/articles/entities/article.entity';

import { AuditRedactionService } from '../services/audit-redaction.service';
import { articleAuditSnapshot } from './article-audit.snapshot';

const article = (): ArticleEntity =>
  ({
    id: 'article-1',
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
    updatedAt: new Date('2026-10-02T12:00:00.000Z'),
    content: {
      title: 'Title',
      summary: 'Summary',
      body: 'Unpublished body content',
    },
    media: { hero: { id: 'image-1', storage_key: 'private/key.png' } },
    attribution: {
      author: { id: 'author-1', identity: { email: 'author@example.test' } },
    },
    publication: {
      status: { id: 'status-draft', key: 'draft', label: 'Draft' },
      publisher: null,
      publishedAt: null,
    },
  }) as ArticleEntity;

describe(articleAuditSnapshot.name, () => {
  it('captures a detached article snapshot using relation IDs only', () => {
    const entity = article();
    const snapshot = articleAuditSnapshot(entity);

    expect(snapshot).toEqual({
      id: 'article-1',
      content: {
        title: 'Title',
        summary: 'Summary',
        body: 'Unpublished body content',
      },
      media: { hero_id: 'image-1' },
      attribution: { author_id: 'author-1' },
      publication: {
        status: { id: 'status-draft', key: 'draft' },
        publisher_id: null,
        published_at: null,
      },
      created_at: '2026-10-01T12:00:00.000Z',
      updated_at: '2026-10-02T12:00:00.000Z',
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/author@example|private\/key/);

    Object.assign(entity.content, { title: 'Mutated entity' });
    expect((snapshot.content as { title: string }).title).toBe('Title');
  });

  it('records body changes without retaining article body content', () => {
    const before = articleAuditSnapshot(article());
    const changed = article();
    Object.assign(changed.content, { body: 'Different confidential body' });
    const after = articleAuditSnapshot(changed);

    const diff = new AuditRedactionService().redactDiff(
      'articles.article',
      before,
      after,
    );
    const serialized = JSON.stringify(diff);

    expect(diff.changes).toEqual({
      content: {
        body: { before: '[CHANGED]', after: '[CHANGED]' },
      },
    });
    expect(serialized).not.toMatch(
      /Unpublished body content|Different confidential body/,
    );
  });
});
