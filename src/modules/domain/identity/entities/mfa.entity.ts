import { Column, Entity, JoinColumn, OneToOne, type Relation } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';

import { UserEntity } from './user.entity';

export enum MfaMethod {
  EMAIL_OTP = 'email_otp',
}

export enum MfaChallengePurpose {
  SIGN_IN = 'sign_in',
  ENABLE = 'enable',
}

@Entity('user_mfa_settings')
export class UserMfaSettingsEntity extends BaseEntity {
  @OneToOne(() => UserEntity, (user) => user.mfa_settings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  public readonly user!: Relation<UserEntity>;

  @Column({ type: 'boolean', default: false })
  public readonly enabled!: boolean;

  @Column({ type: 'enum', enum: MfaMethod, default: MfaMethod.EMAIL_OTP })
  public readonly primary_method!: MfaMethod;

  @Column({ type: 'datetime', nullable: true })
  public readonly enabled_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  public readonly disabled_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  public readonly last_verified_at!: Date | null;
}
