import { BadRequestException } from '@nestjs/common';
import { resolveHeroAccessibility } from './hero-accessibility.policy';

describe('hero accessibility policy', () => {
  it('normalizes descriptive text and supports the character boundary', () => {
    expect(resolveHeroAccessibility('  Useful description  ')).toEqual({
      altText: 'Useful description',
      decorative: false,
    });
    expect(resolveHeroAccessibility('x'.repeat(255)).altText).toHaveLength(255);
    expect(resolveHeroAccessibility('😀'.repeat(255)).decorative).toBe(false);
  });
  it.each([undefined, null, '', '\n\t', 12, 'x'.repeat(256)])(
    'rejects unresolved descriptive text: %s',
    (text) => {
      expect(() => resolveHeroAccessibility(text)).toThrow(BadRequestException);
    },
  );
  it('requires an explicit decorative choice', () => {
    expect(resolveHeroAccessibility(undefined, true)).toEqual({
      altText: null,
      decorative: true,
    });
    expect(resolveHeroAccessibility(null, true)).toEqual({
      altText: null,
      decorative: true,
    });
    expect(() => resolveHeroAccessibility('Stale description', true)).toThrow(
      BadRequestException,
    );
    expect(() => resolveHeroAccessibility(null, 'true')).toThrow(
      BadRequestException,
    );
  });
});
