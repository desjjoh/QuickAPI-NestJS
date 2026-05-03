import { Injectable } from '@nestjs/common';

import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import {
  UserDto,
  UserPaginationOptions,
} from '@/modules/domain/identity/models/user.model';
import {
  PaginationDto,
  PaginationMeta,
} from '@/common/models/pagination.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';

@Injectable()
export class UserAdminService {
  public constructor(private readonly repo: UserRepository) {}

  public async paginateUsers(
    pageOptions: UserPaginationOptions,
  ): Promise<PaginationDto<UserDto>> {
    const [response, itemCount] = await this.repo.paginate(pageOptions);

    return new PaginationDto(
      response.map((e: UserEntity) => new UserDto(e)),
      new PaginationMeta({ pageOptions, itemCount }),
    );
  }

  public async findUser(id: string): Promise<UserDto> {
    const user = await this.repo.findByIdOrFail(id);

    return new UserDto(user);
  }
}
