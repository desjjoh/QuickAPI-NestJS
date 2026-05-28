import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import { BaseModel } from '@/common/models/base.model';
import { AccountStatusEntity } from '../entities/accountstatus.entity';
import { RoleEntity } from '../entities/role.entity';

export class AccountStatusDto {
  @ApiProperty({
    example: 'active',
    description:
      'Stable account status key used by the application to represent the current lifecycle state of an account.',
  })
  public readonly key: string;

  @ApiProperty({
    example: 'Active',
    description:
      'Human-readable account status label displayed in admin interfaces and account management views.',
  })
  public readonly label: string;

  @ApiPropertyOptional({
    example: 'The account is verified, enabled, and allowed to authenticate.',
    description:
      'Optional explanation of what this account status means and how it affects account access.',
    nullable: true,
  })
  public readonly description: string | null;

  public constructor(role: AccountStatusEntity) {
    this.key = role.key;
    this.label = role.label;
    this.description = role.description ?? null;
  }
}

export class BaseAccountStatusDto extends IntersectionType(
  BaseModel,
  AccountStatusDto,
) {
  public constructor(status: RoleEntity) {
    super();

    Object.assign(this, new BaseModel(status), new AccountStatusDto(status));
  }
}
