import { BaseEntity } from '@/common/entities/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('timezones')
export class TimezoneEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  public readonly key!: string;

  @Column({ type: 'text' })
  public readonly label!: string;

  @Column({ type: 'varchar', length: 64 })
  public readonly long_name!: string;

  @Column({ type: 'varchar', length: 32 })
  public readonly region!: string;

  @Column({ type: 'varchar', length: 64 })
  public readonly exemplar_city!: string;
}
