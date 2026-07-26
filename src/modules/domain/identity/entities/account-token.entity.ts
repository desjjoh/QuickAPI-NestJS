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
  public readonly user!: Relation<UserEntity>;

  @Column({ type: 'enum', enum: AccountTokenType })
  public readonly type!: AccountTokenType;

  @Column({ type: 'varchar', length: 128 })
  public readonly token_hash!: string;

  @Column({ type: 'datetime' })
  public readonly expires_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  public readonly consumed_at!: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public readonly mfa_code_hash!: string | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  public readonly failed_attempts!: number;

  @Column({ type: 'datetime', nullable: true })
  public readonly locked_at!: Date | null;

  @Column({ type: 'json', nullable: true })
  public readonly metadata!: Record<string, unknown> | null;
}
