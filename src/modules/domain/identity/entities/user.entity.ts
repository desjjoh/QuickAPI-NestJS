import {
  Entity,
  Column,
  OneToOne,
  JoinTable,
  ManyToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

import { BaseEntity } from '@/common/entities/base.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';

import { UserProfileEntity } from './profile.entity';
import { UserCredentialsEntity } from './credentials.entity';

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
    {
      cascade: true,
      eager: true,
    },
  )
  @JoinColumn({ name: 'credentials_id', referencedColumnName: 'id' })
  public readonly credentials!: UserCredentialsEntity;

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
  public readonly profile!: UserProfileEntity;

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
  public readonly roles?: RoleEntity[];
}
