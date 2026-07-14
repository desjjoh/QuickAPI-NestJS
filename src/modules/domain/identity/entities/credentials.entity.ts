import { Exclude } from 'class-transformer';
import { Entity, OneToOne, Column, type Relation } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';

import { UserEntity } from './user.entity';

@Entity('user_credentials')
export class UserCredentialsEntity extends BaseEntity {
  @OneToOne(() => UserEntity, (user: UserEntity) => user.credentials, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  public readonly user!: Relation<UserEntity>;

  @Exclude()
  @Column({ type: 'text', nullable: true, default: null })
  public readonly refresh!: string | null;

  @Column({ type: 'int', default: 0 })
  public readonly token_version!: number;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  public readonly browser!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  public readonly browser_version!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  public readonly device!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  public readonly os!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  public readonly os_version!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true, default: null })
  public readonly ip_address!: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  public readonly user_agent!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true, default: null })
  public readonly origin!: string | null;
}
