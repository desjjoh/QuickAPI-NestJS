import { PermissionsKey } from '@/config/permissions.config';
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export const Permissions = (...permissions: PermissionsKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
