import { ApiProperty } from '@nestjs/swagger';
import type { UserEntity } from '../entities/user.entity';
import { UserDto } from './user.model';

/** Revision belongs to status/role administration, not profile or session activity. */
export class UserAdministrationDto extends UserDto {
  @ApiProperty({
    minimum: 1,
    maximum: 4294967295,
    description:
      'Administration revision. Send as expected_version for updates or deletion.',
  })
  public readonly version: number;

  public constructor(user: UserEntity) {
    super(user);
    this.version = user.administration_version;
  }
}
