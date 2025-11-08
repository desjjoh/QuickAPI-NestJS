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
import { ItemEntity } from '@/modules/system/database/entities';

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly service: ItemsService) {}

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

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an existing item' })
  @ApiNoContentResponse({ description: 'Item successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Item not found.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
