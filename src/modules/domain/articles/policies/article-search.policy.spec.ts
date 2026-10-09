import {
  articleSearchPattern,
  normalizeArticleSearch,
} from './article-search.policy';

describe('article search policy', () => {
  it.each([undefined, '', ' \t\n\r\u00a0 '])(
    'omits blank search %j',
    (value) => {
      expect(articleSearchPattern(value)).toBeUndefined();
    },
  );

  it('normalizes Unicode and collapses query whitespace without lowercasing text', () => {
    expect(normalizeArticleSearch(' \tCAFE\u0301\n\u00a0  guide  ')).toBe(
      'CAFÉ guide',
    );
    expect(articleSearchPattern('  practical\t\n guide ')).toBe(
      '%practical guide%',
    );
  });

  it.each([
    ['100% growth', '%100!% growth%'],
    ['under_score', '%under!_score%'],
    ['wow!_%', '%wow!!!_!%%'],
    ['C:\\articles', '%C:\\articles%'],
    ["x' OR 1=1 --", "%x' OR 1=1 --%"],
  ])('treats %j as literal search text', (value, expected) => {
    expect(articleSearchPattern(value)).toBe(expected);
  });
});
