import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { resolveHeroAccessibility } from '@/modules/domain/articles/policies/hero-accessibility.policy';

@ValidatorConstraint({ name: 'heroAccessibility', async: false })
class HeroAccessibilityConstraint implements ValidatorConstraintInterface {
  public validate(value: unknown, args: ValidationArguments): boolean {
    try {
      const dto = args.object as HeroAccessibilityDto;
      resolveHeroAccessibility(value, dto.hero_decorative);
      return true;
    } catch {
      return false;
    }
  }

  public defaultMessage(): string {
    return 'Provide visible hero_alt_text (at most 255 characters), or set hero_decorative=true and omit hero_alt_text.';
  }
}

export class HeroAccessibilityDto {
  @ApiPropertyOptional({
    example: 'A maintainable application architecture diagram.',
    description:
      'Required for informative heroes. Must contain visible text. Omit only when hero_decorative=true. Replacement requires a new accessibility choice; previous text is not retained.',
    maxLength: 255,
    nullable: true,
  })
  @Validate(HeroAccessibilityConstraint)
  public readonly hero_alt_text?: string | null;

  @ApiPropertyOptional({
    default: false,
    description:
      'Explicitly marks the hero as decorative. Send true or false (also accepted as multipart strings). When true, omit hero_alt_text; render the image with alt="".',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  public readonly hero_decorative?: boolean = false;
}
