import { Injectable } from '@nestjs/common';
import { DataSource, DeepPartial, Repository } from 'typeorm';

import { Base } from '@/common/models/base.model';
import { omitUndefinedDeep } from '@/common/helpers/typing.helper';

import { ImageEntity } from '../entities/image.entity';

@Injectable()
export class ImageRepository extends Repository<ImageEntity> {
  public constructor(dataSource: DataSource) {
    super(ImageEntity, dataSource.createEntityManager());
  }

  public async createImage(
    payload: DeepPartial<Base<ImageEntity>>,
  ): Promise<ImageEntity> {
    const image: ImageEntity = this.create({
      ...payload,
      alt_text: payload.alt_text ?? null,
    });

    return this.save(image);
  }

  public async findAll(): Promise<ImageEntity[]> {
    return this.find({ order: { createdAt: 'DESC' } });
  }

  public async findById(id: string): Promise<ImageEntity | null> {
    return this.findOne({ where: { id } });
  }

  public async findByStorageKey(
    storage_key: string,
  ): Promise<ImageEntity | null> {
    return this.findOne({ where: { storage_key } });
  }

  public async updateImage(
    image: ImageEntity,
    payload: DeepPartial<Base<ImageEntity>>,
  ): Promise<ImageEntity> {
    const updatedImage: ImageEntity = this.merge(
      image,
      omitUndefinedDeep(payload),
    );

    return this.save(updatedImage);
  }

  public async deleteImage(image: ImageEntity): Promise<ImageEntity> {
    return this.remove(image);
  }
}
