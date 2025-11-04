import { Injectable } from '@nestjs/common';
import { ItemEntity } from '../entities/item.entity';
import { CreateItemDto, UpdateItemDto } from '../dto';

/**
 * Mock service for demonstrating validation and controller interaction.
 * Returns in-memory data instead of querying a database.
 */
@Injectable()
export class ItemsService {
  private readonly mockItems: ItemEntity[] = [
    { id: 1, name: 'Mock Item A', price: 12.99, description: 'A sample item' },
    { id: 2, name: 'Mock Item B', price: 24.5 },
  ];

  findAll(): ItemEntity[] {
    return this.mockItems;
  }

  findOne(id: number): ItemEntity | undefined {
    return this.mockItems.find((item) => item.id === id);
  }

  create(dto: CreateItemDto): ItemEntity {
    const newItem: ItemEntity = {
      id: this.mockItems.length + 1,
      ...dto,
    };
    this.mockItems.push(newItem);
    return newItem;
  }

  update(id: number, dto: UpdateItemDto): ItemEntity | undefined {
    const item = this.findOne(id);
    if (item) Object.assign(item, dto);
    return item;
  }
}
