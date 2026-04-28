import { generatePrimaryId } from '@/common/helpers/nanoid.helper';
import { CreateDateColumn, UpdateDateColumn, PrimaryColumn } from 'typeorm';

export abstract class BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  public readonly id: string = generatePrimaryId();

  @CreateDateColumn()
  public readonly createdAt!: Date;

  @UpdateDateColumn()
  public readonly updatedAt!: Date;
}
