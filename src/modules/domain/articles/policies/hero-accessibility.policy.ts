import { BadRequestException } from '@nestjs/common';

/** Null text alone is not a decorative choice: legacy images remain undecided. */
export function resolveHeroAccessibility(
  altText: unknown,
  decorative: unknown = false,
): { altText: string | null; decorative: boolean } {
  if (typeof decorative !== 'boolean')
    throw new BadRequestException('Hero decorative must be a boolean.');

  if (decorative) {
    if (altText !== undefined && altText !== null)
      throw new BadRequestException(
        'Decorative heroes must omit alternative text.',
      );
    return { altText: null, decorative: true };
  }

  if (
    typeof altText !== 'string' ||
    !altText.trim() ||
    Array.from(altText).length > 255
  )
    throw new BadRequestException(
      'Hero alternative text must contain visible text and be at most 255 characters, or explicitly mark the hero decorative.',
    );

  return { altText: altText.trim(), decorative: false };
}
