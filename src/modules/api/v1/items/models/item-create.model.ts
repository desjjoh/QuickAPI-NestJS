import { IsString, IsNumber, IsOptional, Min, Length } from 'class-validator';
import { Transform } from 'class-transformer';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateItem {
  @ApiPropertyOptional({
    description: 'Descriptive name of the item (max length 120).',
    example: 'Iron Sword',
    minLength: 3,
    maxLength: 120,
    type: String,
  })
  @IsString()
  @Length(3, 120)
  public readonly name!: string;

  @ApiPropertyOptional({
    description:
      'Price of the item represented as a decimal with 2 fractional digits.',
    example: 49.99,
    minimum: 0,
    type: Number,
  })
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  public readonly price!: number;

  @ApiPropertyOptional({
    description:
      'Optional free-text description of the item; null when not provided.',
    example: 'A finely crafted steel blade.',
    type: String,
  })
  @IsOptional()
  @IsString()
  public readonly description?: string;
}
