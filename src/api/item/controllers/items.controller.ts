import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiParam,
} from '@nestjs/swagger';

import { ItemsService } from '../services/items.service';
import { CreateItemDto, UpdateItemDto } from '../dto';
import { ItemEntity } from '../entities/item.entity';

/**
 * @fileoverview
 * Controller managing CRUD operations for `Item` resources.
 *
 * Demonstrates validation via DTOs, transformation via `class-transformer`,
 * and structured API documentation via `@nestjs/swagger`.
 *
 * ---
 * ### Responsibilities
 * - Handle HTTP requests for `/items`
 * - Validate incoming payloads using `class-validator`
 * - Delegate business logic to {@link ItemsService}
 * - Return standardized response objects (`ItemEntity`)
 *
 * ---
 * ### Endpoints
 * | Method | Route        | Description               |
 * |---------|--------------|---------------------------|
 * | GET     | `/items`     | Retrieve all items        |
 * | GET     | `/items/:id` | Retrieve one item by ID   |
 * | POST    | `/items`     | Create a new item         |
 * | PUT     | `/items/:id` | Update an existing item   |
 */
@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly service: ItemsService) {}

  /**
   * Retrieve all existing items.
   *
   * ---
   * ### Example Response
   * ```json
   * [
   *   { "id": 1, "name": "Mechanical Keyboard", "price": 149.99 },
   *   { "id": 2, "name": "Gaming Mouse", "price": 59.99 }
   * ]
   * ```
   */
  @Get()
  @ApiOperation({ summary: 'Retrieve all items' })
  @ApiOkResponse({
    description: 'List of all items.',
    type: [ItemEntity],
  })
  findAll(): ItemEntity[] {
    return this.service.findAll();
  }

  /**
   * Retrieve a specific item by its ID.
   *
   * @param id - Numeric identifier of the item.
   *
   * ---
   * ### Example Response
   * ```json
   * { "id": 1, "name": "Mechanical Keyboard", "price": 149.99 }
   * ```
   */
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an item by ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique identifier of the item',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Item found and returned successfully.',
    type: ItemEntity,
  })
  @ApiNotFoundResponse({ description: 'Item not found.' })
  findOne(@Param('id', ParseIntPipe) id: number): ItemEntity | undefined {
    return this.service.findOne(id);
  }

  /**
   * Create a new item.
   *
   * Validates the request body using {@link CreateItemDto}.
   *
   * ---
   * ### Example Request
   * ```json
   * {
   *   "name": "Ergonomic Chair",
   *   "price": 299.99,
   *   "description": "Mesh back support and adjustable armrests"
   * }
   * ```
   *
   * ### Example Response
   * ```json
   * {
   *   "id": 3,
   *   "name": "Ergonomic Chair",
   *   "price": 299.99
   * }
   * ```
   */
  @Post()
  @ApiOperation({ summary: 'Create a new item' })
  @ApiCreatedResponse({
    description: 'Item successfully created.',
    type: ItemEntity,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed for provided input.',
  })
  create(@Body() dto: CreateItemDto): ItemEntity {
    return this.service.create(dto);
  }

  /**
   * Update an existing item by ID.
   *
   * Validates the request body using {@link UpdateItemDto}.
   *
   * @param id - Numeric identifier of the item to update.
   * @param dto - Updated item data (any subset of `CreateItemDto` fields).
   *
   * ---
   * ### Example Request
   * ```json
   * {
   *   "price": 139.99
   * }
   * ```
   *
   * ### Example Response
   * ```json
   * {
   *   "id": 1,
   *   "name": "Mechanical Keyboard",
   *   "price": 139.99
   * }
   * ```
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing item by ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique identifier of the item to update',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Item successfully updated.',
    type: ItemEntity,
  })
  @ApiNotFoundResponse({ description: 'Item not found.' })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateItemDto,
  ): ItemEntity | undefined {
    return this.service.update(id, dto);
  }
}
