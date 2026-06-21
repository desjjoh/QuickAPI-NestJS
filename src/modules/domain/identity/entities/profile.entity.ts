import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  type Relation,
} from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';

import { UserEntity } from './user.entity';
import { UserAddressEntity } from './address.entity';
import { ImageEntity } from '../../media/entities/image.entity';
import { UserAlternatePhoneEntity, UserPhoneEntity } from './phone.entity';

class Name {
  @Column({ type: 'text' })
  public readonly first!: string;

  @Column({ type: 'text' })
  public readonly last!: string;

  @Column({ type: 'text', nullable: true, default: null })
  public readonly preferred!: string | null;
}

class Media {
  @ManyToOne(() => ImageEntity, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'avatar_id', referencedColumnName: 'id' })
  public readonly avatar!: Relation<ImageEntity | null>;
}

class Personal {
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  public readonly bio!: string | null;

  @Column({ type: 'date' })
  public readonly dob!: string;

  @ManyToOne(() => GenderEntity, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'gender_id', referencedColumnName: 'id' })
  public readonly gender!: Relation<GenderEntity>;
}

class Contact {
  @OneToOne(() => UserPhoneEntity, (phone: UserPhoneEntity) => phone.profile, {
    eager: true,
    cascade: ['insert', 'update'],
    nullable: true,
  })
  public readonly phone!: Relation<UserPhoneEntity | null>;

  @OneToOne(
    () => UserAlternatePhoneEntity,
    (phone: UserAlternatePhoneEntity) => phone.profile,
    {
      eager: true,
      cascade: ['insert', 'update'],
      nullable: true,
    },
  )
  public readonly alternate_phone!: Relation<UserAlternatePhoneEntity | null>;

  @OneToOne(
    () => UserAddressEntity,
    (address: UserAddressEntity) => address.profile,
    {
      eager: true,
      cascade: ['insert', 'update'],
      nullable: true,
    },
  )
  public readonly address!: Relation<UserAddressEntity | null>;
}

@Entity('user_profiles')
export class UserProfileEntity extends BaseEntity {
  public constructor() {
    super();

    this.contact = new Contact();
    this.media = new Media();
  }

  @OneToOne(() => UserEntity, (user: UserEntity) => user.profile, {
    onDelete: 'CASCADE',
  })
  public readonly user!: Relation<UserEntity>;

  @Column(() => Name, { prefix: false })
  public readonly name!: Name;

  @Column(() => Personal, { prefix: false })
  public readonly personal!: Personal;

  @Column(() => Contact, { prefix: false })
  public readonly contact!: Contact;

  @Column(() => Media, { prefix: false })
  public readonly media!: Media;
}
