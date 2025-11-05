import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiBody,
} from '@nestjs/swagger';

import { ItemsService } from '../services/items.service';
import { CreateItemDto, UpdateItemDto } from '../dto';
import { ItemEntity } from '@/modules/database/entities';

/**
 * @fileoverview
 * REST controller exposing CRUD endpoints for {@link ItemEntity}.
 *
 * This controller demonstrates a full NestJS CRUD pattern — integrating
 * data validation, transformation, and automatic OpenAPI (Swagger)
 * documentation through decorators.
 *
 * ---
 * ### Purpose
 * - Serve as a model feature module demonstrating DTO validation,
 *   request transformation, and clean service abstraction.
 * - Provide REST-ful routes backed by TypeORM persistence.
 * - Showcase automatic Swagger documentation generation.
 *
 * ---
 * ### Routes
 * | Method | Path         | Description               |
 * |:-------|:-------------|:--------------------------|
 * | GET    | `/items`     | Retrieve all items        |
 * | GET    | `/items/:id` | Retrieve a single item    |
 * | POST   | `/items`     | Create a new item         |
 * | PUT    | `/items/:id` | Update an existing item   |
 * | DELETE | `/items/:id` | Delete an existing item   |
 *
 * ---
 * ### Example Swagger Request
 * ```json
 * POST /items
 * {
 *   "name": "Wireless Mouse",
 *   "price": 49.99,
 *   "description": "Compact ergonomic design"
 * }
 * ```
 *
 * ---
 * @see {@link ItemsService} for business logic
 * @see {@link ItemEntity} for persistence model
 * @see {@link CreateItemDto} and {@link UpdateItemDto} for validation rules
 */
@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly service: ItemsService) {}

  /**
   * Retrieves all persisted items.
   *
   * @returns A list of all {@link ItemEntity} records.
   */
  @Get()
  @ApiOperation({ summary: 'Retrieve all items' })
  @ApiOkResponse({
    description: 'Returns a list of all items in the database.',
    type: ItemEntity,
    isArray: true,
  })
  async findAll(): Promise<ItemEntity[]> {
    return this.service.findAll();
  }

  /**
   * Retrieves a specific item by its unique identifier.
   *
   * @param id - Numeric item ID parsed from the route parameter.
   * @returns The matching {@link ItemEntity}.
   * @throws 404 Not Found — if the item does not exist.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a specific item by ID' })
  @ApiOkResponse({
    description: 'Returns the item if found.',
    type: ItemEntity,
  })
  @ApiNotFoundResponse({ description: 'Item not found.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ItemEntity> {
    return this.service.findOne(id);
  }

  /**
   * Creates a new item using the provided request body.
   *
   * @param dto - Validated creation payload.
   * @returns The newly created {@link ItemEntity}.
   * @throws 400 Bad Request — if validation fails.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new item' })
  @ApiCreatedResponse({
    description: 'Item successfully created.',
    type: ItemEntity,
  })
  @ApiBody({ type: CreateItemDto })
  async create(@Body() dto: CreateItemDto): Promise<ItemEntity> {
    return this.service.create(dto);
  }

  /**
   * Updates an existing item with new data.
   *
   * @param id - Numeric ID of the item to update.
   * @param dto - Partial update payload.
   * @returns The updated {@link ItemEntity}.
   * @throws 404 Not Found — if the item does not exist.
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update an existing item' })
  @ApiOkResponse({
    description: 'Item successfully updated.',
    type: ItemEntity,
  })
  @ApiNotFoundResponse({ description: 'Item not found.' })
  @ApiBody({ type: UpdateItemDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateItemDto,
  ): Promise<ItemEntity> {
    return this.service.update(id, dto);
  }

  /**
   * Deletes an item by ID.
   *
   * @param id - Numeric ID of the item to remove.
   * @returns No content (204) on success.
   * @throws 404 Not Found — if the item does not exist.
   */
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an existing item' })
  @ApiNoContentResponse({ description: 'Item successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Item not found.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
