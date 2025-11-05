import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ItemEntity } from '@/modules/database/entities';
import { CreateItemDto, UpdateItemDto } from '../dto';

/**
 * @fileoverview
 * Service handling all business logic for {@link ItemEntity}.
 *
 * This layer provides a clean abstraction over TypeORM repositories
 * and ensures validation, transformation, and error handling
 * are applied consistently across controllers.
 *
 * ---
 * ### Responsibilities
 * - CRUD operations for items
 * - Query encapsulation and error mapping
 * - Entity–DTO transformations (if needed later)
 */
@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(ItemEntity)
    private readonly repo: Repository<ItemEntity>,
  ) {}

  /**
   * Retrieves all items from the database.
   *
   * @returns Promise resolving to an array of {@link ItemEntity}.
   */
  async findAll(): Promise<ItemEntity[]> {
    return this.repo.find();
  }

  /**
   * Retrieves a single item by ID.
   *
   * @param id - Numeric identifier of the item.
   * @throws NotFoundException if the item does not exist.
   */
  async findOne(id: number): Promise<ItemEntity> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Item with ID ${id} not found.`);
    return item;
  }

  /**
   * Creates a new item record.
   *
   * @param dto - Validated item creation payload.
   * @returns The newly created {@link ItemEntity}.
   */
  async create(dto: CreateItemDto): Promise<ItemEntity> {
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  /**
   * Updates an existing item.
   *
   * @param id - ID of the item to update.
   * @param dto - Partial update payload.
   * @returns The updated {@link ItemEntity}.
   * @throws NotFoundException if the item does not exist.
   */
  async update(id: number, dto: UpdateItemDto): Promise<ItemEntity> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  /**
   * Removes an item from the database.
   *
   * @param id - ID of the item to delete.
   * @returns void
   * @throws NotFoundException if the item does not exist.
   */
  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }
}
