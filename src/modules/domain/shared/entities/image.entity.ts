import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';

@Entity('images')
export class ImageEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  public readonly storage_key!: string;

  @Column({ type: 'varchar', length: 255 })
  public readonly filename!: string;

  @Column({ type: 'varchar', length: 128 })
  public readonly mime_type!: string;

  @Column({ type: 'int' })
  public readonly size_bytes!: number;

  @Column({ type: 'int' })
  public readonly width!: number;

  @Column({ type: 'int' })
  public readonly height!: number;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  public readonly alt!: string | null;
}
