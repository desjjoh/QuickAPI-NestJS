import { PATH_METADATA } from '@nestjs/common/constants';

import { PublicArticleQueryDto } from '../models/article-query.model';
import { PublicArticleController } from './articles.controller';

describe(PublicArticleController.name, () => {
  const articles = {
    list: jest.fn(),
    find: jest.fn(),
  };
  const controller = new PublicArticleController(articles as never);

  beforeEach(() => jest.clearAllMocks());

  it('owns the public article route and delegates published reads', async () => {
    const query = Object.assign(new PublicArticleQueryDto(), {
      page: 1,
      take: 25,
    });
    const page = { data: [], meta: { page: 1 } };
    const detail = { id: 'A1b2C3d4E5f6G7h8' };
    articles.list.mockResolvedValue(page);
    articles.find.mockResolvedValue(detail);

    await expect(controller.list(query)).resolves.toBe(page);
    await expect(controller.find(detail.id)).resolves.toBe(detail);

    expect(Reflect.getMetadata(PATH_METADATA, PublicArticleController)).toBe(
      '',
    );
    expect(articles.list).toHaveBeenCalledWith(query);
    expect(articles.find).toHaveBeenCalledWith(detail.id);
  });
});
