import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';

@Entity('addresses')
export class AddressEntity extends BaseEntity {
  @Column({ type: 'text' })
  public readonly address_line_1!: string;

  @Column({ type: 'text', nullable: true, default: null })
  public readonly address_line_2!: string | null;

  @Column({ type: 'text' })
  public readonly city!: string;

  @Column({ type: 'text' })
  public readonly region!: string;

  @Column({ type: 'text' })
  public readonly postal_code!: string;

  @ManyToOne(() => CountryEntity, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'country_id', referencedColumnName: 'id' })
  public readonly country!: CountryEntity;
}
