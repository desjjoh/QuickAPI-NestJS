import { Column, Entity, JoinColumn, ManyToOne, type Relation } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { RegionEntity } from '@/modules/domain/library/entities/region.entity';

@Entity('addresses')
export class AddressEntity extends BaseEntity {
  @Column({ type: 'text' })
  public readonly address_line_1!: string;

  @Column({ type: 'text', nullable: true, default: null })
  public readonly address_line_2!: string | null;

  @Column({ type: 'text' })
  public readonly city!: string;

  @ManyToOne(() => RegionEntity, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'region_id', referencedColumnName: 'id' })
  public readonly region!: Relation<RegionEntity>;

  @Column({ type: 'text' })
  public readonly postal_code!: string;

  @ManyToOne(() => CountryEntity, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'country_id', referencedColumnName: 'id' })
  public readonly country!: Relation<CountryEntity>;
}
