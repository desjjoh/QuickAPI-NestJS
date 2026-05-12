import {
  Entity,
  Column,
  OneToOne,
  JoinTable,
  ManyToMany,
  Index,
  JoinColumn,
  type Relation,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';

import { BaseEntity } from '@/common/entities/base.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';

import { UserProfileEntity } from './profile.entity';
import { UserCredentialsEntity } from './credentials.entity';
import { AccountStatusEntity } from '../../library/entities/accountstatus.entity';
import { AccountTokenEntity } from './account-token.entity';

class Identity {
  @Column({ type: 'varchar', length: 254, unique: true })
  public readonly email!: string;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  public readonly phone_e164!: string | null;

  @Exclude()
  @Column({ type: 'text', nullable: true, default: null })
  public readonly password!: string | null;
}

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column(() => Identity, { prefix: false })
  public readonly identity!: Identity;

  @OneToOne(
    () => UserCredentialsEntity,
    (credentials: UserCredentialsEntity) => credentials.user,
    { eager: true, cascade: true, nullable: false },
  )
  @JoinColumn({ name: 'credentials_id', referencedColumnName: 'id' })
  public readonly credentials!: Relation<UserCredentialsEntity>;

  @OneToMany(
    () => AccountTokenEntity,
    (token: AccountTokenEntity) => token.user,
  )
  public readonly account_tokens!: Relation<AccountTokenEntity[]>;

  @OneToOne(
    () => UserProfileEntity,
    (profile: UserProfileEntity) => profile.user,
    {
      cascade: true,
      eager: true,
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'profile_id', referencedColumnName: 'id' })
  public readonly profile!: Relation<UserProfileEntity>;

  @ManyToMany(() => RoleEntity, (role: RoleEntity) => role.users, {
    eager: true,
  })
  @JoinTable({
    name: 'user_roles',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
  })
  public readonly roles?: Relation<RoleEntity[]>;

  @ManyToOne(
    () => AccountStatusEntity,
    (status: AccountStatusEntity) => status.users,
    {
      eager: true,
      nullable: false,
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'status_id', referencedColumnName: 'id' })
  public readonly status!: Relation<AccountStatusEntity>;
}
