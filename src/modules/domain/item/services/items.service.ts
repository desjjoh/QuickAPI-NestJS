import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ItemEntity } from '@/modules/system/database/entities';
import { CreateItemDto, UpdateItemDto } from '../dto';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(ItemEntity)
    private readonly repo: Repository<ItemEntity>,
  ) {}

  async findAll(): Promise<ItemEntity[]> {
    return this.repo.find();
  }

  async findOne(id: number): Promise<ItemEntity> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Item with ID ${id} not found.`);
    return item;
  }

  async create(dto: CreateItemDto): Promise<ItemEntity> {
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateItemDto): Promise<ItemEntity> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }
}
