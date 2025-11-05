/**
 * @fileoverview
 * Centralized export hub for all Item-related entities.
 *
 * This pattern simplifies imports throughout the module,
 * allowing other modules (like {@link TypeOrmModule.forFeature})
 * to import from a single entrypoint rather than multiple paths.
 *
 * ---
 * ### Example
 * ```ts
 * import entities from '@/modules/items/entities';
 *
 * @Module({
 *   imports: [TypeOrmModule.forFeature(entities)],
 * })
 * export class ItemsModule {}
 * ```
 *
 * ---
 * ### Exports
 * - {@link ItemEntity} — Primary ORM entity representing a persisted Item record.
 */
import { ItemEntity } from './_item.entity';

/** Named export for direct imports. */
export { ItemEntity };

/**
 * Default export array for convenient module registration.
 * Used when passing entities to `TypeOrmModule.forFeature()`.
 */
export default [ItemEntity];
