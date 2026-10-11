import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('storage_objects')
@Index('IDX_storage_objects_reconcile', ['state', 'expires_at'])
export class StorageObjectEntity {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  public readonly storage_key!: string;
  @Column({ type: 'varchar', length: 16 })
  public readonly state!:
    | 'reserved'
    | 'uploaded'
    | 'attached'
    | 'deleting'
    | 'deleted';
  @Column({ type: 'datetime', precision: 3 })
  public readonly created_at!: Date;
  @Column({ type: 'datetime', precision: 3, nullable: true })
  public readonly expires_at!: Date | null;
}
