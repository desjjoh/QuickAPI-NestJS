import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('email_intents')
@Index('IDX_email_intents_due', ['state', 'available_at'])
@Index('IDX_email_intents_expiry', ['expires_at'])
export class EmailIntentEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  public readonly delivery_id!: string;
  @Column({ type: 'longtext', nullable: true }) public readonly ciphertext!:
    | string
    | null;
  @Column({ type: 'varchar', length: 16 }) public readonly state!:
    | 'pending'
    | 'delivered'
    | 'cancelled'
    | 'expired';
  @Column({ type: 'datetime', precision: 3 })
  public readonly available_at!: Date;
  @Column({ type: 'datetime', precision: 3 }) public readonly expires_at!: Date;
  @Column({ type: 'datetime', precision: 3 }) public readonly created_at!: Date;
  @Column({ type: 'datetime', precision: 3, nullable: true })
  public readonly delivered_at!: Date | null;
  @Index('IDX_email_intents_scope')
  @Column({ type: 'char', length: 64, nullable: true })
  public readonly cancellation_scope!: string | null;
}
