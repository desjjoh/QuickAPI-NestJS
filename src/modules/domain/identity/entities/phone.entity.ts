import { Entity, JoinColumn, OneToOne, type Relation } from 'typeorm';

import { PhoneEntity } from '@/common/entities/phone.entity';

import { UserProfileEntity } from './profile.entity';

@Entity('user_phones')
export class UserPhoneEntity extends PhoneEntity {
  @OneToOne(() => UserProfileEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profile_id', referencedColumnName: 'id' })
  public readonly profile!: Relation<UserProfileEntity>;
}

@Entity('profile_alternate_phones')
export class UserAlternatePhoneEntity extends PhoneEntity {
  @OneToOne(() => UserProfileEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profile_id', referencedColumnName: 'id' })
  public readonly profile!: Relation<UserProfileEntity>;
}
