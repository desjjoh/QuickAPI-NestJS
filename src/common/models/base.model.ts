import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../entities/base.entity';

interface BaseEntityLike {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Base<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

export class BaseModel {
  @ApiProperty({
    description:
      'Unique 16-character alphanumeric identifier for the resource.',
    example: 'A1b2C3d4E5f6G7h8',
  })
  public readonly id!: string;

  @ApiProperty({
    description:
      'Timestamp indicating when the item was created. Returned as an ISO8601 string.',
    example: '2025-12-01T14:32:11.123Z',
  })
  public readonly createdAt!: Date;

  @ApiProperty({
    description:
      'Timestamp indicating when the item was last updated. Returned as an ISO8601 string.',
    example: '2025-12-10T09:18:45.987Z',
  })
  public readonly updatedAt!: Date;

  protected constructor(entity: BaseEntity) {
    this.id = entity.id;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;

export function WithBaseModel<TBase extends Constructor>(BaseClass: TBase) {
  abstract class BaseModelClass extends BaseClass {
    @ApiProperty()
    public readonly id: string;

    @ApiProperty()
    public readonly createdAt: Date;

    @ApiProperty()
    public readonly updatedAt: Date;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public constructor(...args: any[]) {
      super(...args);

      const entity = args[0] as BaseEntityLike;

      this.id = entity.id;
      this.createdAt = entity.createdAt;
      this.updatedAt = entity.updatedAt;
    }
  }

  return BaseModelClass;
}
