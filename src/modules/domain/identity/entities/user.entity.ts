import {
  Entity,
  Column,
  OneToOne,
  JoinTable,
  ManyToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';

import { BaseEntity } from '@/common/entities/base.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';

import { ProfileEntity } from './profile.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 254, unique: true })
  public readonly email!: string;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  public readonly phone_e164!: string | null;

  @Exclude()
  @Column({ type: 'text' })
  public readonly password!: string;

  @Exclude()
  @Column({ type: 'text', nullable: true, default: null })
  public readonly refresh?: string | null;

  @OneToOne(() => ProfileEntity, (profile: ProfileEntity) => profile.user, {
    cascade: true,
    eager: true,
  })
  public readonly profile!: ProfileEntity;

  @ManyToMany(() => RoleEntity, (role: RoleEntity) => role.users, {
    cascade: true,
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
