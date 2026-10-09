import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateArticleHeroDto {
  @ApiPropertyOptional({
    example: 'A maintainable application architecture diagram.',
    description:
      'Accessible alternative text for the replacement hero image. When omitted, the existing text is retained.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public readonly hero_alt_text?: string;
}
