import { PATH_METADATA } from '@nestjs/common/constants';

import { PERMISSIONS_KEY } from '@/common/decorators/permissions.decorator';
import { ArticleAdministrationPermissions } from '@/config/permissions.config';

import { AdministrationArticleQueryDto } from '../models/article-query.model';
import { ArticleAdministrationController } from './articles.controller';

describe(ArticleAdministrationController.name, () => {
  const articles = {
    list: jest.fn(),
    find: jest.fn(),
    publish: jest.fn(),
    returnToDraft: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
  };
  const controller = new ArticleAdministrationController(articles as never);
  const administrator = { id: 'administrator-1' };
  const reason = { reason_code: 'policy_enforcement' as const };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const operation of Object.values(articles))
      operation.mockResolvedValue({ id: 'article-1' });
  });

  it('owns the administration article route and delegates review reads', async () => {
    const query = new AdministrationArticleQueryDto();

    await controller.list(query);
    await controller.find('article-1');

    expect(
      Reflect.getMetadata(PATH_METADATA, ArticleAdministrationController),
    ).toBe('articles');
    expect(articles.list).toHaveBeenCalledWith(query);
    expect(articles.find).toHaveBeenCalledWith('article-1');
  });

  it('delegates administration lifecycle actions and their reasons', async () => {
    await controller.publish(administrator as never, 'article-1');
    await controller.returnToDraft(administrator as never, 'article-1', reason);
    await controller.archive(administrator as never, 'article-1', reason);
    await controller.restore(administrator as never, 'article-1', reason);

    expect(articles.publish).toHaveBeenCalledWith(administrator, 'article-1');
    expect(articles.returnToDraft).toHaveBeenCalledWith(
      administrator,
      'article-1',
      reason,
    );
    expect(articles.archive).toHaveBeenCalledWith(
      administrator,
      'article-1',
      reason,
    );
    expect(articles.restore).toHaveBeenCalledWith(
      administrator,
      'article-1',
      reason,
    );
  });

  it.each([
    ['list', ArticleAdministrationPermissions.READ_ARTICLES],
    ['find', ArticleAdministrationPermissions.READ_ARTICLES],
    ['publish', ArticleAdministrationPermissions.PUBLISH_ARTICLES],
    [
      'returnToDraft',
      ArticleAdministrationPermissions.RETURN_ARTICLES_TO_DRAFT,
    ],
    ['archive', ArticleAdministrationPermissions.ARCHIVE_ARTICLES],
    ['restore', ArticleAdministrationPermissions.RESTORE_ARTICLES],
  ] as const)('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ArticleAdministrationController.prototype[method],
      ),
    ).toEqual([permission]);
  });
});
