import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';

type ApiFileUploadOptions = {
  fieldName: string;
  required?: boolean;
  description?: string;
  bodyType?: Type<unknown>;
};

export function ApiFileUpload({
  fieldName,
  required = true,
  description = 'File upload payload.',
  bodyType,
}: ApiFileUploadOptions) {
  const fileSchema = {
    type: 'object' as const,
    required: required ? [fieldName] : [],
    properties: {
      [fieldName]: {
        type: 'string' as const,
        format: 'binary',
        description,
      },
    },
  };

  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ...(bodyType ? [ApiExtraModels(bodyType)] : []),
    ApiBody({
      description,
      schema: bodyType
        ? { allOf: [{ $ref: getSchemaPath(bodyType) }, fileSchema] }
        : fileSchema,
    }),
  );
}
