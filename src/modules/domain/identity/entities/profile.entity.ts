import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import { ImageEntity } from '@/modules/domain/library/entities/image.entity';

import { UserEntity } from './user.entity';
import { UserAddressEntity } from './address.entity';

class Name {
  @Column({ type: 'text' })
  public readonly first!: string;

  @Column({ type: 'text' })
  public readonly last!: string;

  @Column({ type: 'text', nullable: true, default: null })
  public readonly preferred!: string | null;
}

class Personal {
  @Column({ type: 'date' })
  public readonly dob!: string;

  @ManyToOne(() => GenderEntity, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'gender_id', referencedColumnName: 'id' })
  public readonly gender!: GenderEntity;
}

class Contact {
  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  public readonly alternate_phone_e164!: string | null;

  @OneToOne(
    () => UserAddressEntity,
    (address: UserAddressEntity) => address.profile,
    {
      eager: true,
      cascade: ['insert', 'update'],
      nullable: true,
    },
  )
  public readonly address!: UserAddressEntity | null;
}

@Entity('user_profiles')
export class UserProfileEntity extends BaseEntity {
  @OneToOne(() => UserEntity, (user: UserEntity) => user.profile, {
    onDelete: 'CASCADE',
  })
  public readonly user!: UserEntity;

  @Column(() => Name, { prefix: false })
  public readonly name!: Name;

  @Column(() => Personal, { prefix: false })
  public readonly personal!: Personal;

  @Column(() => Contact, { prefix: false })
  public readonly contact!: Contact;

  @ManyToOne(() => ImageEntity, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'avatar_id', referencedColumnName: 'id' })
  public readonly avatar!: ImageEntity | null;
}
