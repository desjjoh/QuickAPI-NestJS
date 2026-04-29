import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { GenderEntity } from '../entities/gender.entity';

@Injectable()
export class GenderRepository extends Repository<GenderEntity> {
  public constructor(dataSource: DataSource) {
    super(GenderEntity, dataSource.createEntityManager());
  }

  public async findAll(): Promise<GenderEntity[]> {
    return this.find({
      order: {
        key: 'ASC',
      },
    });
  }

  public async findById(id: string): Promise<GenderEntity | null> {
    return this.findOneBy({ id });
  }

  public async findByKey(key: string): Promise<GenderEntity | null> {
    return this.findOneBy({ key });
  }
}
