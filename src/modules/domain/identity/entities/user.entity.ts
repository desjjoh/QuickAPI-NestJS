import {
  Entity,
  Column,
  OneToOne,
  JoinTable,
  ManyToMany,
  Index,
} from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { Exclude } from 'class-transformer';
import { ProfileEntity } from './profile.entity';
import { RoleEntity } from './role.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ type: 'text', unique: true })
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
  public readonly roles: RoleEntity[] = [];
}
