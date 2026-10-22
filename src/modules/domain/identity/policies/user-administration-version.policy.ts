import { BadRequestException, ConflictException } from '@nestjs/common';
import type { UserEntity } from '../entities/user.entity';

export function assertUserAdministrationVersion(
  user: UserEntity,
  expectedVersion: number,
): void {
  if (
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    expectedVersion > 4294967295
  ) {
    throw new BadRequestException(
      'A positive integer expected_version is required.',
    );
  }

  if (user.administration_version !== expectedVersion) {
    throw new ConflictException(
      'User administration state has changed. Reload the user before retrying.',
    );
  }
}
