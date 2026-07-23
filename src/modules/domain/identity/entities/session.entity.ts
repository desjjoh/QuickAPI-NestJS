import { Exclude } from 'class-transformer';
import { Entity, ManyToOne, Column, type Relation } from 'typeorm';

import { BaseEntity } from '@/common/entities/base.entity';

import { UserEntity } from './user.entity';

class Location {
  @Column({ type: 'varchar', length: 2, nullable: true })
  public readonly country_code!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public readonly country_name!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  public readonly region_code!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public readonly region_name!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public readonly city!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  public readonly source!: string | null;

  @Column({ type: 'datetime', nullable: true })
  public readonly resolved_at!: Date | null;
}

@Entity('user_sessions')
export class UserSessionEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, (user) => user.sessions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  public readonly user!: Relation<UserEntity>;

  @Exclude()
  @Column({ type: 'text', nullable: true, default: null })
  public readonly refresh!: string | null;

  @Column({ type: 'int', default: 0 })
  public readonly token_version!: number;

  @Column({ type: 'boolean', default: true })
  public readonly active!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  public readonly browser!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  public readonly browser_version!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  public readonly device!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  public readonly os!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  public readonly os_version!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true, default: null })
  public readonly ip_address!: string | null;

  @Column(() => Location, { prefix: false })
  public readonly location!: Location;

  @Column({ type: 'text', nullable: true, default: null })
  public readonly user_agent!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true, default: null })
  public readonly origin!: string | null;
}
