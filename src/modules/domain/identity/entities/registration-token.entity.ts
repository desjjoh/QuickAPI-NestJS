import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';

export type RegistrationTokenMetadata = {
  email: string;
  password: string;
  profile: {
    name: {
      first: string;
      last: string;
      preferred: null;
    };
    personal: {
      bio: null;
      dob: string;
      gender: { id: string };
    };
    region: {
      country: { id: string };
      timezone: { id: string };
    };
  };
};

@Entity('registration_tokens')
export class RegistrationTokenEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 254 })
  public readonly email!: string;

  @Column({ type: 'varchar', length: 128 })
  public readonly token_hash!: string;

  @Column({ type: 'datetime' })
  public readonly expires_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  public readonly consumed_at!: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public readonly mfa_code_hash!: string | null;

  @Column({ type: 'json' })
  public readonly metadata!: RegistrationTokenMetadata;
}
