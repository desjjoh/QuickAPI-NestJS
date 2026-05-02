import { applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export function ApiPlatformAdmin() {
  return applyDecorators(ApiTags('Platform Administration'));
}
