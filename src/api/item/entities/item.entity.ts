/**
 * Simplified mock entity representing an Item record.
 * In a real application, this would map to a database table via TypeORM.
 */
export class ItemEntity {
  public readonly id!: number;
  public readonly name!: string;
  public readonly price!: number;
  public readonly description?: string;
}
