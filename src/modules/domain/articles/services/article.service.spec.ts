import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { ArticleEntity } from '../entities/article.entity';
import {
  ARTICLE_STATUS_KEYS,
  ArticleStatusKey,
} from '../seeders/status.seeder';
import { ArticleService } from './article.service';
import { ArticleStatusTransitionPolicy } from '../policies/article-status-transition.policy';

function article(status: ArticleStatusKey = ARTICLE_STATUS_KEYS.DRAFT) {
  return {
    id: 'article-1',
    content: { title: 'Title', summary: 'Summary', body: 'Body' },
    media: { hero: { id: 'hero-1' } },
    attribution: { author: { id: 'author-1' } },
    publication: {
      status: { id: `status-${status}`, key: status },
      publisher: null,
      publishedAt: null,
    },
  } as ArticleEntity;
}

describe('ArticleService', () => {
  const statuses = Object.fromEntries(
    Object.values(ARTICLE_STATUS_KEYS).map((key) => [
      key,
      { id: `status-${key}`, key },
    ]),
  );
  const manager = {
    transaction: jest.fn(),
    create: jest.fn(),
    merge: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const articleRepo = {
    manager,
    lastSaved: undefined as ArticleEntity | undefined,
    findAll: jest.fn(),
    findById: jest.fn(),
    findByStatusKey: jest.fn(),
    findByAuthorId: jest.fn(),
  };
  const statusRepo = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByKey: jest.fn(),
  };
  const imageSvc = { findById: jest.fn() };
  const userSvc = { findByIdOrFail: jest.fn() };
  let service: ArticleService;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.transaction.mockImplementation(async (work) => work(manager));
    manager.create.mockImplementation((_entity, value) => ({
      ...value,
      content: { ...(value.content ?? {}) },
      media: { ...(value.media ?? {}) },
      attribution: { ...(value.attribution ?? {}) },
      publication: { ...(value.publication ?? {}) },
    }));
    manager.merge.mockImplementation((_entity, base, value) => ({
      ...base,
      ...value,
      content: { ...base.content, ...(value.content ?? {}) },
      media: { ...base.media, ...(value.media ?? {}) },
      attribution: { ...base.attribution, ...(value.attribution ?? {}) },
      publication: { ...base.publication, ...(value.publication ?? {}) },
    }));
    manager.save.mockImplementation(async (_entity, value) => ({
      id: value.id ?? 'created-article',
      ...value,
    }));
    articleRepo.findById.mockImplementation(async (_manager, id) =>
      articleRepo.lastSaved?.id === id ? articleRepo.lastSaved : article(),
    );
    Object.assign(articleRepo, { lastSaved: undefined });
    manager.save.mockImplementation(async (_entity, value) => {
      const saved = { id: value.id ?? 'created-article', ...value };
      articleRepo.lastSaved = saved;
      return saved;
    });
    statusRepo.findByKey.mockImplementation(async (_manager, key) =>
      key in statuses ? statuses[key] : null,
    );
    imageSvc.findById.mockResolvedValue({ id: 'hero-2' });
    userSvc.findByIdOrFail.mockImplementation(async (id) => ({ id }));
    service = new ArticleService(
      articleRepo as never,
      statusRepo as never,
      imageSvc as never,
      userSvc as never,
      new ArticleStatusTransitionPolicy(),
    );
  });

  it('owns transactions and delegates manager-first reads', async () => {
    const work = jest.fn().mockResolvedValue('done');
    articleRepo.findAll.mockResolvedValue([]);
    articleRepo.findByStatusKey.mockResolvedValue([]);
    articleRepo.findByAuthorId.mockResolvedValue([]);

    await expect(service.transaction(work)).resolves.toBe('done');
    await service.findAll();
    await service.findPublished();
    await service.findByAuthor('author-1');

    expect(manager.transaction).toHaveBeenCalledWith(work);
    expect(articleRepo.findAll).toHaveBeenCalledWith(manager);
    expect(articleRepo.findByStatusKey).toHaveBeenCalledWith(
      manager,
      ARTICLE_STATUS_KEYS.PUBLISHED,
    );
    expect(articleRepo.findByAuthorId).toHaveBeenCalledWith(
      manager,
      'author-1',
    );
  });

  it('throws a domain not-found error for an unknown article', async () => {
    articleRepo.findById.mockResolvedValue(null);
    await expect(service.findByIdOrFail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a draft with resolved hero and author without mutating input', async () => {
    const input = {
      content: { title: 'New', summary: 'New summary', body: 'New body' },
      heroId: 'hero-2',
      authorId: 'author-2',
    };
    const original = structuredClone(input);

    const created = await service.create(input);

    expect(created.id).toBe('created-article');
    expect(statusRepo.findByKey).toHaveBeenCalledWith(
      manager,
      ARTICLE_STATUS_KEYS.DRAFT,
    );
    expect(imageSvc.findById).toHaveBeenCalledWith('hero-2', manager);
    expect(userSvc.findByIdOrFail).toHaveBeenCalledWith('author-2', manager);
    expect(manager.create).toHaveBeenCalledWith(
      ArticleEntity,
      expect.objectContaining({
        content: input.content,
        media: { hero: { id: 'hero-2' } },
        attribution: { author: { id: 'author-2' } },
        publication: {
          status: { id: 'status-draft' },
          publisher: null,
          publishedAt: null,
        },
      }),
    );
    expect(input).toEqual(original);
  });

  it('creates an unattributed draft when no author is supplied', async () => {
    await service.create({
      content: { title: 'New', summary: 'Summary', body: 'Body' },
      heroId: 'hero-2',
    });

    expect(userSvc.findByIdOrFail).not.toHaveBeenCalled();
    expect(manager.create).toHaveBeenCalledWith(
      ArticleEntity,
      expect.objectContaining({ attribution: { author: null } }),
    );
  });

  it('updates a detached article and supports clearing attribution', async () => {
    const current = article();
    const original = structuredClone(current);

    await service.update(current, {
      content: { title: 'Changed' },
      heroId: 'hero-2',
      authorId: null,
    });

    expect(manager.create).toHaveBeenCalledWith(ArticleEntity, current);
    expect(manager.merge).toHaveBeenCalledWith(
      ArticleEntity,
      expect.any(Object),
      expect.objectContaining({
        content: { title: 'Changed' },
        media: { hero: { id: 'hero-2' } },
        attribution: { author: null },
      }),
    );
    expect(current).toEqual(original);
    expect(articleRepo.lastSaved?.attribution.author).toBeNull();
  });

  it('submits only drafts and clears stale publication data', async () => {
    const current = article();
    await service.submit(current);

    expect(statusRepo.findByKey).toHaveBeenCalledWith(
      manager,
      ARTICLE_STATUS_KEYS.SUBMITTED,
    );
    expect(articleRepo.lastSaved?.publication).toEqual(
      expect.objectContaining({
        status: { id: 'status-submitted' },
        publisher: null,
        publishedAt: null,
      }),
    );

    await expect(
      service.submit(article(ARTICLE_STATUS_KEYS.PUBLISHED)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publishes a submitted article with publisher and timestamp', async () => {
    const publishedAt = new Date('2026-10-08T12:00:00.000Z');
    await service.publish(
      article(ARTICLE_STATUS_KEYS.SUBMITTED),
      'publisher-1',
      publishedAt,
    );

    expect(userSvc.findByIdOrFail).toHaveBeenCalledWith('publisher-1', manager);
    expect(articleRepo.lastSaved?.publication).toEqual(
      expect.objectContaining({
        status: { id: 'status-published' },
        publisher: { id: 'publisher-1' },
        publishedAt,
      }),
    );
  });

  it('rejects invalid publication dates and lifecycle transitions', async () => {
    await expect(
      service.publish(
        article(ARTICLE_STATUS_KEYS.SUBMITTED),
        'publisher-1',
        new Date('invalid'),
      ),
    ).rejects.toThrow('publishedAt must be a valid date.');
    expect(userSvc.findByIdOrFail).not.toHaveBeenCalled();

    userSvc.findByIdOrFail.mockClear();
    await expect(service.publish(article(), 'publisher-1')).rejects.toThrow(
      'cannot transition',
    );
    expect(userSvc.findByIdOrFail).not.toHaveBeenCalled();
    await expect(
      service.archive(article(ARTICLE_STATUS_KEYS.SUBMITTED)),
    ).rejects.toThrow('cannot transition');
  });

  it('archives published articles and restores submitted or archived articles to draft', async () => {
    await service.archive(article(ARTICLE_STATUS_KEYS.PUBLISHED));
    expect(articleRepo.lastSaved?.publication.status).toEqual({
      id: 'status-archived',
    });

    const archived = article(ARTICLE_STATUS_KEYS.ARCHIVED);
    Object.assign(archived.publication, {
      publisher: { id: 'publisher-1' },
      publishedAt: new Date(),
    });
    await service.returnToDraft(archived);
    expect(articleRepo.lastSaved?.publication).toEqual(
      expect.objectContaining({
        status: { id: 'status-draft' },
        publisher: null,
        publishedAt: null,
      }),
    );
  });

  it('owns status lookups and reports missing configuration', async () => {
    statusRepo.findAll.mockResolvedValue(Object.values(statuses));
    statusRepo.findById.mockResolvedValue(null);

    await expect(service.findStatuses()).resolves.toEqual(
      Object.values(statuses),
    );
    await expect(
      service.findStatusByIdOrFail('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);

    statusRepo.findByKey.mockResolvedValue(null);
    await expect(
      service.create({
        content: { title: 'New', summary: 'Summary', body: 'Body' },
        heroId: 'hero-2',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('deletes through the manager without mutating the supplied article', async () => {
    const current = article();
    await expect(service.remove(current)).resolves.toBe(current);
    expect(manager.delete).toHaveBeenCalledWith(ArticleEntity, {
      id: current.id,
    });
  });
});
