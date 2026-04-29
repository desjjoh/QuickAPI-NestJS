import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { RoleEntity } from './role.entity';

@Entity('permissions')
export class PermissionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  public readonly key!: string;

  @Column({ type: 'text' })
  public readonly label!: string;

  @Column({ type: 'text', nullable: true, default: null })
  public readonly description!: string | null;

  @ManyToMany(() => RoleEntity, (role: RoleEntity) => role.permissions)
  public readonly roles?: RoleEntity[];
}
