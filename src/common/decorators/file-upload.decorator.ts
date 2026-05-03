import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

type ApiFileUploadOptions = {
  fieldName: string;
  required?: boolean;
  description?: string;
};

export function ApiFileUpload({
  fieldName,
  required = true,
  description = 'File upload payload.',
}: ApiFileUploadOptions) {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      description,
      schema: {
        type: 'object',
        required: required ? [fieldName] : [],
        properties: {
          [fieldName]: {
            type: 'string',
            format: 'binary',
            description,
          },
        },
      },
    }),
  );
}
