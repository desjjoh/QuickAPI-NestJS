import { registerDecorator, ValidationOptions } from 'class-validator';

/** Storage limits expressed in bytes must not be treated as character limits. */
export function MaxUtf8Bytes(limit: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxUtf8Bytes',
      target: object.constructor,
      propertyName,
      constraints: [limit],
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          Buffer.byteLength(value, 'utf8') <= limit,
        defaultMessage: () =>
          `${propertyName} must not exceed ${limit} UTF-8 bytes`,
      },
    });
  };
}
