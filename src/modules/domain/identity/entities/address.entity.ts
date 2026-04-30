import { Entity, OneToOne, JoinColumn } from 'typeorm';

import { AddressEntity } from '@/common/entities/address.entity';

import { UserProfileEntity } from './profile.entity';

@Entity('profile_addresses')
export class UserAddressEntity extends AddressEntity {
  @OneToOne(() => UserProfileEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profile_id', referencedColumnName: 'id' })
  public readonly profile!: UserProfileEntity;
}
