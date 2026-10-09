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

  it.each(Object.values(ARTICLE_STATUS_KEYS))(
    'allows editing only when the article is a draft: %s',
    (current) => {
      if (current === ARTICLE_STATUS_KEYS.DRAFT)
        expect(() => policy.assertEditable(current)).not.toThrow();
      else
        expect(() => policy.assertEditable(current)).toThrow(
          'Only draft articles can be updated.',
        );
    },
  );

  it.each(Object.values(ARTICLE_STATUS_KEYS))(
    'allows administration return only when the article is submitted: %s',
    (current) => {
      if (current === ARTICLE_STATUS_KEYS.SUBMITTED)
        expect(() => policy.assertCanReturnToDraft(current)).not.toThrow();
      else
        expect(() => policy.assertCanReturnToDraft(current)).toThrow(
          'Only submitted articles can be returned to draft.',
        );
    },
  );

  it.each(Object.values(ARTICLE_STATUS_KEYS))(
    'allows restoration only when the article is archived: %s',
    (current) => {
      if (current === ARTICLE_STATUS_KEYS.ARCHIVED)
        expect(() => policy.assertCanRestore(current)).not.toThrow();
      else
        expect(() => policy.assertCanRestore(current)).toThrow(
          'Only archived articles can be restored.',
        );
    },
  );

  it.each(Object.values(ARTICLE_STATUS_KEYS))(
    'allows creator withdrawal only when the article is submitted: %s',
    (current) => {
      if (current === ARTICLE_STATUS_KEYS.SUBMITTED)
        expect(() => policy.assertCanWithdraw(current)).not.toThrow();
      else
        expect(() => policy.assertCanWithdraw(current)).toThrow(
          'Only submitted articles can be withdrawn.',
        );
    },
  );

  it('publishes an immutable transition definition', () => {
    expect(Object.isFrozen(ARTICLE_STATUS_TRANSITIONS)).toBe(true);
    expect(
      Object.values(ARTICLE_STATUS_TRANSITIONS).every(Object.isFrozen),
    ).toBe(true);
  });
});
