import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { ItemDto } from '../models/item.model';
import { ItemsApiService } from '../services/items.service';
import { CreateItem } from '../models/item-create.model';
import { ErrorResponseDto } from '@/library/models/exception.model';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import { EntityIdParam } from '@/common/decorators/id-param.decorator';
import { UpdateItem } from '../models/item-update.model';

@Controller()
export class ItemsApiController {
  constructor(private readonly svc: ItemsApiService) {}

  // POST /
  @Post('')
  @ApiOperation({ summary: 'Create a new item' })
  @ApiCreatedResponse({ description: 'Successful Response.', type: ItemDto })
  @ApiBody({ type: CreateItem })
  async create_item(@Body() dto: CreateItem): Promise<ItemDto> {
    return this.svc.create(dto);
  }

  // GET /
  @Get('')
  @ApiOperation({
    summary: 'Get a list of items',
    description:
      'Retrieves a paginated list of items. Supports page, limit, sorting, and optional filtering.',
  })
  @ApiOkResponse({ description: 'Successful Response.', type: [ItemDto] })
  async get_items(): Promise<ItemDto[]> {
    return this.svc.getAll();
  }

  // GET /:id
  @Get(':id')
  @EntityIdParam
  @ApiOperation({
    summary: 'Get a single item by ID',
    description:
      'Fetches a single item by its unique identifier. Returns 404 if the item does not exist.',
  })
  @ApiOkResponse({ description: 'Successful Response.', type: ItemDto })
  @ApiNotFoundResponse({
    description: 'No item exists with the provided identifier.',
    type: ErrorResponseDto,
  })
  async get_item(@Param('id', NanoIdParamPipe) id: string): Promise<ItemDto> {
    return this.svc.getById(id);
  }

  // PATCH /:id
  @Patch(':id')
  @EntityIdParam
  @ApiOperation({
    summary: 'Update an item by ID',
    description:
      'Applies a partial update to an existing item. Only provided fields are modified. Returns the updated resource.',
  })
  @ApiOkResponse({ description: 'Successful Response.', type: ItemDto })
  @ApiNotFoundResponse({
    description: 'No item exists with the provided identifier.',
    type: ErrorResponseDto,
  })
  async update_item(
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: UpdateItem,
  ): Promise<ItemDto> {
    return this.svc.patch(id, dto);
  }

  // PUT /:id
  @Put(':id')
  @EntityIdParam
  @ApiOperation({
    summary: 'Update an item by ID',
    description:
      'Applies a partial update to an existing item. Only provided fields are modified. Returns the updated resource.',
  })
  @ApiOkResponse({ description: 'Successful Response.', type: ItemDto })
  @ApiNotFoundResponse({
    description: 'No item exists with the provided identifier.',
    type: ErrorResponseDto,
  })
  async replace_item(
    @Param('id', NanoIdParamPipe) id: string,
    @Body() dto: CreateItem,
  ): Promise<ItemDto> {
    return this.svc.put(id, dto);
  }

  // DELETE /:id
  @Delete(':id')
  @EntityIdParam
  @ApiOperation({
    summary: 'Delete an item by ID',
    description:
      'Removes an item by its ID. Returns the deleted resource for confirmation. Returns 404 if the item is not found.',
  })
  @ApiOkResponse({ description: 'Successful Response.', type: ItemDto })
  @ApiNotFoundResponse({
    description: 'No item exists with the provided identifier.',
    type: ErrorResponseDto,
  })
  async delete_item(
    @Param('id', NanoIdParamPipe) id: string,
  ): Promise<ItemDto> {
    return this.svc.remove(id);
  }
}
