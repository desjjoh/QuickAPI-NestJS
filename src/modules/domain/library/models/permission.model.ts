import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionEntity } from '../entities/permission.entity';

export class PermissionDto {
  @ApiProperty({
    example: 'pR9x2mLpQ8rT4zAa',
    description: 'Unique identifier for the permission record.',
  })
  public readonly id: string;

  @ApiProperty({
    example: 'create_users',
    description:
      'Stable permission key used by the application to authorize access to a specific action or capability.',
  })
  public readonly key: string;

  @ApiProperty({
    example: 'Create users',
    description:
      'Human-readable permission name displayed in admin interfaces.',
  })
  public readonly label: string;

  @ApiPropertyOptional({
    example: 'Allows the user to create other users.',
    description:
      'Optional explanation of what the permission allows within the application.',
    nullable: true,
  })
  public readonly description: string | null;

  public constructor(permission: PermissionEntity) {
    this.id = permission.id;
    this.key = permission.key;
    this.label = permission.label;
    this.description = permission.description ?? null;
  }
}
