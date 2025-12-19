import { Injectable, PipeTransform } from '@nestjs/common';
import { UnprocessableContentError } from '../exceptions/http.exception';

const ENTITY_ID_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ENTITY_ID_LENGTH = 16;

@Injectable()
export class NanoIdParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string') {
      throw new UnprocessableContentError(
        'Invalid id: value must be a string.',
      );
    }

    if (value.length !== ENTITY_ID_LENGTH) {
      throw new UnprocessableContentError(
        `Invalid id: expected exactly ${ENTITY_ID_LENGTH} characters, received ${value.length}.`,
      );
    }

    for (const char of value) {
      if (!ENTITY_ID_ALPHABET.includes(char)) {
        throw new UnprocessableContentError(
          'Invalid id: only base62 characters (A-Z, a-z, 0-9) are allowed.',
        );
      }
    }

    return value;
  }
}
