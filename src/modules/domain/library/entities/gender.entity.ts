import { BaseEntity } from '@/common/entities/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('genders')
export class GenderEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  public readonly key!: string;

  @Column({ type: 'text' })
  public readonly label!: string;
}
