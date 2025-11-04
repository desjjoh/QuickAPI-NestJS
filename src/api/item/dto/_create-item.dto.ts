/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsString, IsNumber, IsOptional, Min, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * @fileoverview
 * Defines the schema and validation rules for incoming `Item` creation requests.
 * This Data Transfer Object (DTO) is used to validate and transform request bodies
 * sent to the `POST /items` endpoint.
 *
 * Each field includes type validation (via `class-validator`)
 * and optional transformation logic (via `class-transformer`),
 * ensuring consistent, strongly-typed input before persistence or business logic.
 *
 * ---
 * ### Example Request
 * ```json
 * {
 *   "name": "Mechanical Keyboard",
 *   "price": 149.99,
 *   "description": "Hot-swappable switches and RGB lighting"
 * }
 * ```
 *
 * ---
 * ### Usage
 * ```ts
 * @Post()
 * create(@Body() dto: CreateItemDto): Promise<ItemEntity> {
 *   return this.itemsService.create(dto);
 * }
 * ```
 */
export class CreateItemDto {
  /**
   * The human-readable name of the item.
   *
   * @example "Mechanical Keyboard"
   * @minimumLength 3
   * @maximumLength 120
   * @decorator `@IsString()` — Ensures the input is a valid string.
   * @decorator `@Length(3, 120)` — Enforces minimum and maximum character length.
   */
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

  /**
   * The monetary price of the item.
   *
   * @example 149.99
   * @minimum 0
   * @decorator `@IsNumber()` — Validates that the input is numeric.
   * @decorator `@Min(0)` — Ensures the value is non-negative.
   * @decorator `@Transform()` — Converts string inputs (e.g., `"42"`) to numbers.
   */
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

  /**
   * Optional description of the item.
   *
   * @example "Hot-swappable switches and RGB lighting"
   * @decorator `@IsOptional()` — Allows omission of this field.
   * @decorator `@IsString()` — Validates that, if present, the value is a string.
   */
  @ApiPropertyOptional({
    example: 'Hot-swappable switches and RGB lighting',
    description: 'Optional description providing extra item details.',
    type: String,
  })
  @IsOptional()
  @IsString()
  public readonly description?: string;
}
