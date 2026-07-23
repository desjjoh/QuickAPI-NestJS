import {
  Entity,
  Column,
  OneToOne,
  JoinTable,
  ManyToMany,
  JoinColumn,
  type Relation,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';

import { BaseEntity } from '@/common/entities/base.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';

import { UserProfileEntity } from './profile.entity';
import { UserSessionEntity } from './session.entity';
import { AccountStatusEntity } from '../../library/entities/accountstatus.entity';
import { AccountTokenEntity } from './account-token.entity';

class Metadata {
  @Column({ type: 'datetime', nullable: true })
  public readonly last_sign_in!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  public readonly last_changed_email!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  public readonly last_changed_password!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  public readonly last_updated_at!: Date | null;
}

export type UserMetadata = Metadata;

export const createUserMetadata = (
  overrides: Partial<UserMetadata> = {},
): UserMetadata => ({
  last_sign_in: null,
  last_changed_email: null,
  last_changed_password: null,
  last_updated_at: null,
  ...overrides,
});

class Identity {
  @Column({ type: 'varchar', length: 254, unique: true })
  public readonly email!: string;

  @Exclude()
  @Column({ type: 'text', nullable: true, default: null })
  public readonly password!: string | null;
}

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column(() => Identity, { prefix: false })
  public readonly identity!: Identity;

  @OneToMany(() => UserSessionEntity, (session) => session.user)
  public readonly sessions!: Relation<UserSessionEntity[]>;

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

  @Column(() => Metadata, { prefix: false })
  public readonly metadata!: UserMetadata;

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
