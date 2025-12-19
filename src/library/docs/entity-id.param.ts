import { ApiParam } from '@nestjs/swagger';

export const ENTITY_ID_REGEX = '^[0-9A-Za-z]{16}$';

export const EntityIdParam = ApiParam({
  name: 'id',
  required: true,
  description:
    'Unique entity identifier (16-character NanoID using a base62 alphabet).',
  schema: {
    type: 'string',
    minLength: 16,
    maxLength: 16,
    example: 'V9aKQ2ZxW8M1FJtB',
    pattern: ENTITY_ID_REGEX,
  },
});
