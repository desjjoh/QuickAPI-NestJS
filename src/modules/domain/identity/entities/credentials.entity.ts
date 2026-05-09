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
}
