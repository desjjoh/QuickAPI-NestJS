import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({
    example: 'Building Maintainable NestJS Domains',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Title must contain visible text.' })
  @MaxLength(255)
  public readonly title!: string;

  @ApiProperty({
    example:
      'A practical guide to separating persistence and application logic.',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Summary must contain visible text.' })
  @MaxLength(255)
  public readonly summary!: string;

  @ApiProperty({
    example: 'Long-form article content…',
    maxLength: 65535,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Body must contain visible text.' })
  @MaxLength(65535)
  public readonly body!: string;

  @ApiProperty({
    example: 'A maintainable application architecture diagram.',
    description: 'Optional accessible alternative text for the hero image.',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public readonly hero_alt_text?: string;
}
