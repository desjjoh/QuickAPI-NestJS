import { IsString, IsNumber, IsOptional, Min, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty({
    example: 'Mechanical Keyboard',
    description: 'Human-readable name of the item.',
    minLength: 3,
    maxLength: 120,
    type: String,
  })
  @IsString()
  @Length(3, 120)
  public readonly name!: string;

  @ApiProperty({
    example: 149.99,
    description: 'Monetary price of the item (must be non-negative).',
    minimum: 0,
    type: Number,
  })
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  public readonly price!: number;

  @ApiPropertyOptional({
    example: 'Hot-swappable switches and RGB lighting',
    description: 'Optional description providing extra item details.',
    type: String,
  })
  @IsOptional()
  @IsString()
  public readonly description?: string;
}
