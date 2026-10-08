import { BadRequestException } from '@nestjs/common';

import {
  ARTICLE_STATUS_KEYS,
  ArticleStatusKey,
} from '../seeders/status.seeder';
import {
  ARTICLE_STATUS_TRANSITIONS,
  ArticleStatusTransitionPolicy,
} from './article-status-transition.policy';

describe('ArticleStatusTransitionPolicy', () => {
  const policy = new ArticleStatusTransitionPolicy();
  const keys = Object.values(ARTICLE_STATUS_KEYS);
  const allowed = new Set([
    'draft:submitted',
    'submitted:draft',
    'submitted:published',
    'published:archived',
    'archived:draft',
  ]);

  it.each(
    keys.flatMap((current) =>
      keys.map(
        (target) =>
          [current, target, allowed.has(`${current}:${target}`)] as const,
      ),
    ),
  )('evaluates the %s -> %s transition', (current, target, expected) => {
    expect(policy.canTransition(current, target)).toBe(expected);

    if (expected)
      expect(() =>
        policy.assertCanTransition(current, target, {
          ...(target === ARTICLE_STATUS_KEYS.PUBLISHED
            ? { publishedAt: new Date('2026-10-08T12:00:00.000Z') }
            : {}),
        }),
      ).not.toThrow();
    else
      expect(() => policy.assertCanTransition(current, target)).toThrow(
        BadRequestException,
      );
  });

  it.each<[ArticleStatusKey, readonly ArticleStatusKey[]]>([
    [ARTICLE_STATUS_KEYS.DRAFT, [ARTICLE_STATUS_KEYS.SUBMITTED]],
    [
      ARTICLE_STATUS_KEYS.SUBMITTED,
      [ARTICLE_STATUS_KEYS.DRAFT, ARTICLE_STATUS_KEYS.PUBLISHED],
    ],
    [ARTICLE_STATUS_KEYS.PUBLISHED, [ARTICLE_STATUS_KEYS.ARCHIVED]],
    [ARTICLE_STATUS_KEYS.ARCHIVED, [ARTICLE_STATUS_KEYS.DRAFT]],
  ])('reports the allowed targets from %s', (current, targets) => {
    expect(policy.allowedTargets(current)).toEqual(targets);
  });

  it('rejects an unknown persisted status without leaking a TypeError', () => {
    expect(policy.allowedTargets('retired')).toEqual([]);
    expect(policy.canTransition('retired', ARTICLE_STATUS_KEYS.DRAFT)).toBe(
      false,
    );
    expect(() =>
      policy.assertCanTransition('retired', ARTICLE_STATUS_KEYS.DRAFT),
    ).toThrow('Article cannot transition from "retired" to "draft".');
  });

  it.each([undefined, new Date('invalid')])(
    'requires a valid publication timestamp when publishing',
    (publishedAt) => {
      expect(() =>
        policy.assertCanTransition(
          ARTICLE_STATUS_KEYS.SUBMITTED,
          ARTICLE_STATUS_KEYS.PUBLISHED,
          { publishedAt },
        ),
      ).toThrow('publishedAt must be a valid date.');
    },
  );

  it('publishes an immutable transition definition', () => {
    expect(Object.isFrozen(ARTICLE_STATUS_TRANSITIONS)).toBe(true);
    expect(
      Object.values(ARTICLE_STATUS_TRANSITIONS).every(Object.isFrozen),
    ).toBe(true);
  });
});
