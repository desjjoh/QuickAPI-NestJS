import { Column, Entity, OneToMany, type Relation } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { RegionEntity } from './region.entity';

@Entity('countries')
export class CountryEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  public readonly key!: string;

  @Column({ type: 'text' })
  public readonly label!: string;

  @Column({ type: 'char', length: 2, unique: true })
  public readonly iso2!: string;

  @Column({ type: 'char', length: 3, unique: true })
  public readonly iso3!: string;

  @Column({ type: 'varchar', length: 255 })
  public readonly flag_url!: string;

  @Column({ type: 'varchar', length: 8 })
  public readonly calling_code!: string;

  @OneToMany(() => RegionEntity, (region: RegionEntity) => region.country)
  public readonly regions?: Relation<RegionEntity[]>;

  @Column({ type: 'varchar', length: 32 })
  public readonly phone_national_placeholder!: string;

  @Column({ type: 'varchar', length: 128 })
  public readonly phone_national_pattern!: string;

  @Column({ type: 'simple-json' })
  public readonly phone_format_groups!: number[];

  @Column({ type: 'varchar', length: 32 })
  public readonly postal_code_placeholder!: string;

  @Column({ type: 'varchar', length: 128 })
  public readonly postal_code_pattern!: string;

  @Column({ type: 'simple-json' })
  public readonly postal_code_format_groups!: number[];

  @Column({ type: 'varchar', length: 8 })
  public readonly postal_code_format_separator!: string;
}
