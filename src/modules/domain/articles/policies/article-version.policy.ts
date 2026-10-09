import { BadRequestException, ConflictException } from '@nestjs/common';
import { ArticleEntity } from '../entities/article.entity';

export function assertArticleVersion(
  article: ArticleEntity,
  expectedVersion: number,
): void {
  if (
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    expectedVersion > 4294967295
  )
    throw new BadRequestException(
      'A positive integer expected_version is required.',
    );
  if (article.version !== expectedVersion)
    throw new ConflictException(
      'Article has changed. Reload it before retrying.',
    );
}
