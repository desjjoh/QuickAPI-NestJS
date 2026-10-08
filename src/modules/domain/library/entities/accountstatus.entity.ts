import { Entity, OneToMany, type Relation } from 'typeorm';

import { StatusEntity } from '@/common/entities/status.entity';

import { UserEntity } from '../../identity/entities/user.entity';

@Entity('account_statuses')
export class AccountStatusEntity extends StatusEntity {
  @OneToMany(() => UserEntity, (user: UserEntity) => user.status)
  public users?: Relation<UserEntity[]>;
}
