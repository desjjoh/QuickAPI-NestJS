import { ArticleEntity } from '../entities/article.entity';
import {
  ArticleAuthorDto,
  ArticleDto,
  ArticleImageDto,
  ArticleListItemDto,
  ArticleStatusDto,
} from './article.model';

describe('article outbound models', () => {
  const timestamp = new Date('2026-10-08T12:00:00.000Z');
  const image = {
    id: 'image-1',
    storage_key: '/articles/hero.png',
    filename: 'hero.png',
    mime_type: 'image/png',
    size_bytes: 42,
    width: 1600,
    height: 900,
    alt_text: 'Article hero',
  };
  const avatar = {
    ...image,
    id: 'avatar-1',
    storage_key: 'avatars/pat.png',
    width: 256,
    height: 256,
    alt_text: null,
  };
  const author = {
    id: 'author-1',
    identity: { email: 'private@example.test', password: 'private-hash' },
    profile: {
      name: { first: 'Pat', last: 'Person', preferred: 'P' },
      media: { avatar },
    },
    roles: [{ key: 'administrator' }],
    metadata: { mfa_enabled: true },
  };
  const publisher = {
    ...author,
    id: 'publisher-1',
    profile: {
      name: { first: 'Jamie', last: 'Publisher', preferred: null },
      media: { avatar: null },
    },
  };

  function article(overrides: Record<string, unknown> = {}): ArticleEntity {
    return {
      id: 'article-1',
      createdAt: timestamp,
      updatedAt: timestamp,
      content: {
        title: 'Article title',
        summary: 'Article summary',
        body: 'Complete article body',
      },
      media: { hero: image },
      attribution: { author },
      publication: {
        status: {
          id: 'status-published',
          key: 'published',
          label: 'Published',
          description: 'Publicly visible',
        },
        publisher,
        publishedAt: timestamp,
      },
      ...overrides,
    } as unknown as ArticleEntity;
  }

  it('creates a public image projection without storage metadata', () => {
    const model = new ArticleImageDto(image as never);

    expect(model).toEqual({
      id: 'image-1',
      url: 'https://assets.test.example.com/articles/hero.png',
      width: 1600,
      height: 900,
      altText: 'Article hero',
    });
    expect(model).not.toHaveProperty('storage_key');
    expect(model).not.toHaveProperty('filename');
    expect(model).not.toHaveProperty('size_bytes');
  });

  it('creates a minimal author projection using preferred display information', () => {
    const model = new ArticleAuthorDto(author as never);

    expect(model).toEqual({
      id: 'author-1',
      displayName: 'P',
      avatar: expect.objectContaining({
        id: 'avatar-1',
        url: 'https://assets.test.example.com/avatars/pat.png',
      }),
    });
    expect(model).not.toHaveProperty('identity');
    expect(model).not.toHaveProperty('roles');
    expect(model).not.toHaveProperty('metadata');
  });

  it('falls back to the full name and supports a missing avatar', () => {
    expect(new ArticleAuthorDto(publisher as never)).toEqual({
      id: 'publisher-1',
      displayName: 'Jamie Publisher',
      avatar: null,
    });
  });

  it('maps article status without exposing persistence metadata', () => {
    const model = new ArticleStatusDto(article().publication.status as never);

    expect(model).toEqual({ key: 'published', label: 'Published' });
    expect(model).not.toHaveProperty('description');
    expect(model).not.toHaveProperty('id');
  });

  it('creates a compact list item without body or publisher details', () => {
    const model = new ArticleListItemDto(article());

    expect(model).toEqual(
      expect.objectContaining({
        id: 'article-1',
        createdAt: timestamp,
        updatedAt: timestamp,
        title: 'Article title',
        summary: 'Article summary',
        hero: expect.any(ArticleImageDto),
        author: expect.any(ArticleAuthorDto),
        status: { key: 'published', label: 'Published' },
        publishedAt: timestamp,
      }),
    );
    expect(model).not.toHaveProperty('body');
    expect(model).not.toHaveProperty('publisher');
  });

  it('creates the complete article model with body and publisher credit', () => {
    const entity = article();
    const original = structuredClone(entity);
    const model = new ArticleDto(entity);

    expect(model).toEqual(
      expect.objectContaining({
        title: 'Article title',
        summary: 'Article summary',
        body: 'Complete article body',
        publisher: {
          id: 'publisher-1',
          displayName: 'Jamie Publisher',
          avatar: null,
        },
      }),
    );
    expect(entity).toEqual(original);
  });

  it('preserves nullable author, publisher, and publication fields', () => {
    const entity = article({
      attribution: { author: null },
      publication: {
        status: {
          id: 'status-draft',
          key: 'draft',
          label: 'Draft',
        },
        publisher: null,
        publishedAt: null,
      },
    });

    expect(new ArticleListItemDto(entity)).toEqual(
      expect.objectContaining({ author: null, publishedAt: null }),
    );
    expect(new ArticleDto(entity).publisher).toBeNull();
  });
});
