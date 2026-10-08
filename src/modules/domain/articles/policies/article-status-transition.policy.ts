import { BadRequestException, Injectable } from '@nestjs/common';

import {
  ARTICLE_STATUS_KEYS,
  ArticleStatusKey,
} from '../seeders/status.seeder';

export const ARTICLE_STATUS_TRANSITIONS: Readonly<
  Record<ArticleStatusKey, readonly ArticleStatusKey[]>
> = Object.freeze({
  [ARTICLE_STATUS_KEYS.DRAFT]: Object.freeze([ARTICLE_STATUS_KEYS.SUBMITTED]),
  [ARTICLE_STATUS_KEYS.SUBMITTED]: Object.freeze([
    ARTICLE_STATUS_KEYS.DRAFT,
    ARTICLE_STATUS_KEYS.PUBLISHED,
  ]),
  [ARTICLE_STATUS_KEYS.PUBLISHED]: Object.freeze([
    ARTICLE_STATUS_KEYS.ARCHIVED,
  ]),
  [ARTICLE_STATUS_KEYS.ARCHIVED]: Object.freeze([ARTICLE_STATUS_KEYS.DRAFT]),
});

const NO_ARTICLE_STATUS_TRANSITIONS: readonly ArticleStatusKey[] =
  Object.freeze([]);

export type ArticleTransitionContext = {
  publishedAt?: Date;
};

@Injectable()
export class ArticleStatusTransitionPolicy {
  public allowedTargets(current: string): readonly ArticleStatusKey[] {
    return (
      ARTICLE_STATUS_TRANSITIONS[current as ArticleStatusKey] ??
      NO_ARTICLE_STATUS_TRANSITIONS
    );
  }

  public canTransition(current: string, target: ArticleStatusKey): boolean {
    return this.allowedTargets(current).includes(target);
  }

  public assertCanTransition(
    current: string,
    target: ArticleStatusKey,
    context: ArticleTransitionContext = {},
  ): void {
    if (!this.canTransition(current, target))
      throw new BadRequestException(
        `Article cannot transition from "${current}" to "${target}".`,
      );

    if (
      target === ARTICLE_STATUS_KEYS.PUBLISHED &&
      (!context.publishedAt || Number.isNaN(context.publishedAt.getTime()))
    )
      throw new BadRequestException('publishedAt must be a valid date.');
  }
}
