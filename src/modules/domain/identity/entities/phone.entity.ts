import { Entity, JoinColumn, OneToOne, type Relation } from 'typeorm';

import { PhoneEntity } from '@/common/entities/phone.entity';

import { UserProfileEntity } from './profile.entity';
import { UserEntity } from './user.entity';

@Entity('user_phones')
export class UserPhoneEntity extends PhoneEntity {
  @OneToOne(() => UserEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  public readonly user!: Relation<UserEntity>;
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
