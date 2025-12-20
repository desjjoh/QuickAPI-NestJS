import { Injectable } from '@nestjs/common';

import { ItemsRepository } from '@/modules/domain/items/repository/items.repository';
import { ItemEntity } from '@/modules/domain/items/entities/item.entity';

import { ItemDto } from '../models/item.model';
import { NotFoundError } from '@/common/exceptions/http.exception';
import { CreateItem } from '../models/item-create.model';
import { UpdateItem } from '../models/item-update.model';

@Injectable()
export class ItemsApiService {
  constructor(private readonly itemsService: ItemsRepository) {}

  public async create(payload: CreateItem): Promise<ItemDto> {
    const item = await this.itemsService.create(payload);

    return new ItemDto(item);
  }

  public async getAll(): Promise<ItemDto[]> {
    const items: ItemEntity[] = await this.itemsService.findAll();

    return items.map((item) => new ItemDto(item));
  }

  public async getById(id: string): Promise<ItemDto> {
    const item = await this.itemsService.findOneById(id);

    if (!item) throw new NotFoundError(`Resource with ID '${id}' not found`);

    return new ItemDto(item);
  }

  public async patch(id: string, payload: UpdateItem): Promise<ItemDto> {
    const item = await this.itemsService.findOneById(id);

    if (!item) throw new NotFoundError(`Resource with ID '${id}' not found`);

    const updated = await this.itemsService.update(item, payload);
    return new ItemDto(updated);
  }

  public async put(id: string, payload: CreateItem): Promise<ItemDto> {
    const item = await this.itemsService.findOneById(id);

    if (!item) throw new NotFoundError(`Resource with ID '${id}' not found`);

    const updated = await this.itemsService.update(item, {
      ...payload,
      description: payload.description ?? null,
    });

    return new ItemDto(updated);
  }

  public async remove(id: string): Promise<ItemDto> {
    const item = await this.itemsService.findOneById(id);

    if (!item) throw new NotFoundError(`Resource with ID '${id}' not found`);

    await this.itemsService.remove(item);

    return new ItemDto(item);
  }
}
