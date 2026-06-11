import { Column, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';

export abstract class PhoneEntity extends BaseEntity {
  @Index()
  @ManyToOne(() => CountryEntity, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'phone_country_id', referencedColumnName: 'id' })
  public readonly country!: Relation<CountryEntity>;

  @Column({ type: 'varchar', length: 8 })
  public readonly phone_calling_code!: string;

  @Column({ type: 'varchar', length: 20 })
  public readonly phone_national_number!: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  public readonly phone_e164!: string;
}
