import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
  type Relation,
} from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { CountryEntity } from './country.entity';

@Entity('country_regions')
@Unique(['country', 'key'])
@Unique(['country', 'code'])
export class RegionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 64 })
  public readonly key!: string;

  @Column({ type: 'varchar', length: 16 })
  public readonly code!: string;

  @Column({ type: 'text' })
  public readonly label!: string;

  @ManyToOne(() => CountryEntity, (country: CountryEntity) => country.regions, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'country_id', referencedColumnName: 'id' })
  public readonly country!: Relation<CountryEntity>;
}
