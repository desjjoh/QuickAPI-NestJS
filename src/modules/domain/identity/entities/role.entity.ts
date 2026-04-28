import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { UserEntity } from './user.entity';
import { PermissionEntity } from './permission.entity';

@Entity('roles')
export class RoleEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  public readonly key!: string;

  @Column({ type: 'text' })
  public readonly label!: string;

  @Column({ type: 'text', nullable: true, default: null })
  public readonly description!: string | null;

  @ManyToMany(() => UserEntity, (user) => user.roles)
  public readonly users: UserEntity[] = [];

  @ManyToMany(
    () => PermissionEntity,
    (permission: PermissionEntity) => permission.roles,
  )
  @JoinTable({
    name: 'role_permissions',
    joinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'permission_id',
      referencedColumnName: 'id',
    },
  })
  public readonly permissions: PermissionEntity[] = [];
}
