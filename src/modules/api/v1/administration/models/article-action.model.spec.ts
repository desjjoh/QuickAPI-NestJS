import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ArticleAdministrationActionDto } from './article-action.model';
import { AdministrationActionDto } from './administration-action.model';

describe('administration article version preconditions', () => {
  it('requires both the article version and action reason', async () => {
    expect(
      await validate(
        plainToInstance(ArticleAdministrationActionDto, {
          expected_version: 1,
          reason_code: 'data_correction',
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(ArticleAdministrationActionDto, {
          reason_code: 'data_correction',
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'expected_version' }),
      ]),
    );
    expect(
      await validate(
        plainToInstance(ArticleAdministrationActionDto, {
          expected_version: 1,
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'reason_code' }),
      ]),
    );
  });
  it('does not add article version requirements to user administration actions', async () => {
    expect(
      await validate(
        plainToInstance(AdministrationActionDto, {
          reason_code: 'data_correction',
        }),
      ),
    ).toEqual([]);
  });
});
