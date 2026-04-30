// src/modules/users/repositories/user.repository.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, DeepPartial, Repository } from 'typeorm';

import { Base } from '@/common/models/base.model';

import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UserRepository extends Repository<UserEntity> {
  public constructor(private readonly dataSource: DataSource) {
    super(UserEntity, dataSource.createEntityManager());
  }

  public async incrementTokenVersion(userId: string): Promise<void> {
    await this.increment({ id: userId }, 'credentials.token_version', 1);
  }

  public async findByEmail(email: string): Promise<UserEntity | null> {
    return this.findOne({ where: { identity: { email } } });
  }

  public async findByPhone(phone_e164: string): Promise<UserEntity | null> {
    return this.findOne({ where: { identity: { phone_e164 } } });
  }

  public async findByIdOrFail(id: string): Promise<UserEntity> {
    const user = await this.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');

    return user;
  }

  public async createUser(
    payload: DeepPartial<Base<UserEntity>>,
  ): Promise<UserEntity> {
    const user = this.create(payload);
    const created = await this.save(user);

    return this.findByIdOrFail(created.id);
  }
}
