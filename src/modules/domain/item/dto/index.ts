import { CreateItemDto } from './_create-item.dto';
import { UpdateItemDto } from './_update-item.dto';

/**
 * @fileoverview
 * Central export hub for all Item Data Transfer Objects (DTOs).
 *
 * This file provides a unified import path for the `Item` module’s DTOs,
 * improving maintainability and ensuring consistent import structure across
 * controllers, services, and tests.
 *
 * ---
 * ### Purpose
 * - Simplifies imports:
 *   ```ts
 *   import { CreateItemDto, UpdateItemDto } from '@/modules/items/dto';
 *   ```
 * - Keeps DTO management modular — each DTO (e.g., Create, Update) remains
 *   in its own file for clarity and scalability.
 *
 * ---
 * ### Exports
 * - {@link CreateItemDto} — Defines validation and schema for creating a new item.
 * - {@link UpdateItemDto} — Extends `CreateItemDto` for updating existing items (all fields optional).
 */
export { CreateItemDto, UpdateItemDto };
