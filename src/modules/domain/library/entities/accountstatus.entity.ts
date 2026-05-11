import { Column, Entity, Index, OneToMany, type Relation } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { UserEntity } from '../../identity/entities/user.entity';

@Entity('account_statuses')
export class AccountStatusEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  public key!: string;

  @Column({ type: 'text' })
  public label!: string;

  @Column({ type: 'text', nullable: true })
  public description!: string | null;

  @OneToMany(() => UserEntity, (user: UserEntity) => user.status)
  public users?: Relation<UserEntity[]>;
}
