import { Column, Entity, JoinColumn, ManyToOne, type Relation } from 'typeorm';

import { AccountTokenType } from '@/config/token.config';
import { BaseEntity } from '@/common/entities/base.entity';

import { UserEntity } from './user.entity';

@Entity('account_tokens')
export class AccountTokenEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, (user: UserEntity) => user.account_tokens, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  public user!: Relation<UserEntity>;

  @Column({ type: 'enum', enum: AccountTokenType })
  public readonly type!: AccountTokenType;

  @Column({ type: 'varchar', length: 128 })
  public token_hash!: string;

  @Column({ type: 'datetime' })
  public expires_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  public consumed_at!: Date | null;
}
