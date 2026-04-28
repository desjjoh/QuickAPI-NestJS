import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';

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

  @Column({ type: 'varchar', length: 8 })
  public readonly calling_code!: string;
}
