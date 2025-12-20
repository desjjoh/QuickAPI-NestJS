import { IsString, IsNumber, IsOptional, Min, Length } from 'class-validator';
import { Transform } from 'class-transformer';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateItem {
  @ApiPropertyOptional({
    description: 'Updated descriptive name of the item (max length 120).',
    example: 'Iron Sword',
    minLength: 3,
    maxLength: 120,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(3, 120)
  public readonly name?: string;

  @ApiPropertyOptional({
    description:
      'Updated price of the item represented as a decimal with 2 fractional digits.',
    example: 49.99,
    minimum: 0,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  public readonly price?: number;

  @ApiPropertyOptional({
    description:
      'Updated free-text description of the item; omitted when unchanged.',
    example: 'A finely crafted steel blade.',
    type: String,
  })
  @IsOptional()
  @IsString()
  public readonly description?: string;
}
