import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateArticleDto {
  @ApiPropertyOptional({
    example: 'Building Maintainable NestJS Domains',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'Title must contain visible text.' })
  @MaxLength(255)
  public readonly title?: string;

  @ApiPropertyOptional({
    example:
      'A practical guide to separating persistence and application logic.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'Summary must contain visible text.' })
  @MaxLength(255)
  public readonly summary?: string;

  @ApiPropertyOptional({
    example: 'Updated long-form article content…',
    maxLength: 65535,
  })
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'Body must contain visible text.' })
  @MaxLength(65535)
  public readonly body?: string;
}
