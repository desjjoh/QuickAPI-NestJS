import { Injectable } from '@nestjs/common';

import { ItemsRepository } from '@/modules/domain/items/repository/items.repository';
import { ItemEntity } from '@/modules/domain/items/entities/item.entity';

import { Item } from '../models/item.model';
import { NotFoundError } from '@/common/exceptions/http.exception';
import { CreateItem } from '../models/item-create.model';
import { UpdateItem } from '../models/item-update.model';

@Injectable()
export class ItemsApiService {
  constructor(private readonly itemsService: ItemsRepository) {}

  public async create(payload: CreateItem): Promise<Item> {
    return this.itemsService.create(payload);
  }

  public async getAll(): Promise<Item[]> {
    const items: ItemEntity[] = await this.itemsService.findAll();

    return items.map((item) => new Item(item));
  }

  public async getById(id: string): Promise<Item> {
    const item = await this.itemsService.findOneById(id);

    if (!item) throw new NotFoundError(`Resource with ID '${id}' not found`);

    return new Item(item);
  }

  public async patch(id: string, payload: UpdateItem): Promise<Item> {
    const item = await this.itemsService.findOneById(id);

    if (!item) throw new NotFoundError(`Resource with ID '${id}' not found`);

    const updated = await this.itemsService.update(item, payload);
    return updated;
  }

  public async put(id: string, payload: CreateItem): Promise<Item> {
    const item = await this.itemsService.findOneById(id);

    if (!item) throw new NotFoundError(`Resource with ID '${id}' not found`);

    const updated = await this.itemsService.update(item, {
      ...payload,
      description: payload.description ?? null,
    });

    return updated;
  }

  public async remove(id: string): Promise<Item> {
    const item = await this.itemsService.findOneById(id);

    if (!item) throw new NotFoundError(`Resource with ID '${id}' not found`);

    const removed = await this.itemsService.remove(item);
    return new Item(removed);
  }
}
