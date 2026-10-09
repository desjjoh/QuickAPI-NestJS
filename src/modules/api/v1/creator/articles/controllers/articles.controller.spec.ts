import { PATH_METADATA } from '@nestjs/common/constants';

import { PERMISSIONS_KEY } from '@/common/decorators/permissions.decorator';
import { ArticleCreatorPermissions } from '@/config/permissions.config';

import { CreatorArticleQueryDto } from '../models/article-query.model';
import { CreatorArticleController } from './articles.controller';

describe(CreatorArticleController.name, () => {
  const articles = {
    list: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateHero: jest.fn(),
    submit: jest.fn(),
    withdraw: jest.fn(),
  };
  const controller = new CreatorArticleController(articles as never);
  const user = { id: 'creator-1' };
  const file = { originalname: 'hero.png' } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const operation of Object.values(articles))
      operation.mockResolvedValue({ id: 'article-1' });
  });

  it('owns articles within the creator API area', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CreatorArticleController)).toBe(
      'articles',
    );
  });

  it('delegates creator reads with the authenticated user scope', async () => {
    const query = new CreatorArticleQueryDto();

    await controller.list(user as never, query);
    await controller.find(user as never, 'article-1');

    expect(articles.list).toHaveBeenCalledWith(user, query);
    expect(articles.find).toHaveBeenCalledWith(user, 'article-1');
  });

  it('delegates multipart creation and hero replacement without exposing image IDs', async () => {
    const create = {
      title: 'Title',
      summary: 'Summary',
      body: 'Body',
      hero_alt_text: 'Hero description',
    };
    const replacement = {
      hero_alt_text: 'Replacement description',
      expected_version: 1,
    };

    await controller.create(user as never, create, file);
    await controller.updateHero(user as never, 'article-1', replacement, file);

    expect(articles.create).toHaveBeenCalledWith(user, create, file);
    expect(articles.updateHero).toHaveBeenCalledWith(
      user,
      'article-1',
      replacement,
      file,
    );
    expect(create).not.toHaveProperty('hero_id');
  });

  it('delegates content and lifecycle mutations', async () => {
    const update = { title: 'Updated', expected_version: 1 };

    await controller.update(user as never, 'article-1', update);
    await controller.submit(user as never, 'article-1', {
      expected_version: 1,
    });
    await controller.withdraw(user as never, 'article-1', {
      expected_version: 1,
    });

    expect(articles.update).toHaveBeenCalledWith(user, 'article-1', update);
    expect(articles.submit).toHaveBeenCalledWith(user, 'article-1', {
      expected_version: 1,
    });
    expect(articles.withdraw).toHaveBeenCalledWith(user, 'article-1', {
      expected_version: 1,
    });
  });

  it.each([
    ['list', ArticleCreatorPermissions.READ_OWN_ARTICLES],
    ['find', ArticleCreatorPermissions.READ_OWN_ARTICLES],
    ['create', ArticleCreatorPermissions.CREATE_ARTICLES],
    ['update', ArticleCreatorPermissions.UPDATE_OWN_ARTICLES],
    ['updateHero', ArticleCreatorPermissions.UPDATE_OWN_ARTICLES],
    ['submit', ArticleCreatorPermissions.SUBMIT_OWN_ARTICLES],
    ['withdraw', ArticleCreatorPermissions.WITHDRAW_OWN_ARTICLES],
  ] as const)('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        CreatorArticleController.prototype[method],
      ),
    ).toEqual([permission]);
  });
});
