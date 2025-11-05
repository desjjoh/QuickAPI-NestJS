import { PartialType } from '@nestjs/mapped-types';
import { ApiExtraModels } from '@nestjs/swagger';
import { CreateItemDto } from './_create-item.dto';

/**
 * @fileoverview
 * Defines the Data Transfer Object (DTO) for updating an existing item.
 *
 * This class extends {@link CreateItemDto} using NestJS's `PartialType` utility,
 * which automatically transforms all properties into optional fields while
 * preserving their validation and Swagger metadata.
 *
 * ---
 * ### Purpose
 * - Used for `PATCH /items/:id` or `PUT /items/:id` endpoints.
 * - Ensures consistent field typing and validation rules with `CreateItemDto`.
 * - Allows partial updates (e.g., updating only `price` or `description`).
 *
 * ---
 * ### Example Request
 * ```json
 * {
 *   "price": 129.99
 * }
 * ```
 *
 * ---
 * ### Usage
 * ```ts
 * @Patch(':id')
 * update(@Param('id') id: string, @Body() dto: UpdateItemDto): Promise<ItemEntity> {
 *   return this.itemsService.update(id, dto);
 * }
 * ```
 *
 * ---
 * ### OpenAPI / Swagger Notes
 * The `PartialType()` utility preserves field-level metadata from `CreateItemDto`,
 * so no duplicate property decorators are required here. Swagger will automatically
 * display all `CreateItemDto` fields as optional under this model.
 */
@ApiExtraModels(CreateItemDto)
export class UpdateItemDto extends PartialType(CreateItemDto) {}
