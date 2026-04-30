import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEntity } from '../entities/role.entity';
import { PermissionEntity } from '../entities/permission.entity';

export class RoleDto {
  @ApiProperty({
    example: 'admin',
    description:
      'Stable role key used by the application to assign and check groups of permissions.',
  })
  public readonly key: string;

  @ApiProperty({
    example: 'Administrator',
    description: 'Human-readable role name displayed in admin interfaces.',
  })
  public readonly label: string;

  @ApiPropertyOptional({
    example: 'Users with full administrative access.',
    description:
      'Optional explanation of the access level or responsibility represented by the role.',
    nullable: true,
  })
  public readonly description: string | null;

  @ApiProperty({
    type: [String],
    description:
      'Stable permissions keys granted to users who are assigned this role.',
  })
  public readonly permissions: string[];

  public constructor(role: RoleEntity) {
    this.key = role.key;
    this.label = role.label;
    this.description = role.description ?? null;
    this.permissions =
      role.permissions?.map((permission: PermissionEntity) => permission.key) ??
      [];
  }
}
