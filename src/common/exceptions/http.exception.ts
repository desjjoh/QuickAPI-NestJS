import { ValidationError } from 'class-validator';

import { AppException } from './app.exception';
import { formatClassValidatorIssues } from '@/common/helpers/validation.helper';

// 400 Bad Request
export class BadRequestError extends AppException {
  constructor(message: string = 'Bad Request') {
    super(400, message);
  }
}

// 403 Forbidden
export class ForbiddenError extends AppException {
  constructor(message: string = 'Forbidden') {
    super(403, message);
  }
}

// 404 Not Found
export class NotFoundError extends AppException {
  constructor(message: string = 'Not Found') {
    super(404, message);
  }
}

// 405 Method Not Allowed
export class MethodNotAllowedError extends AppException {
  constructor(message: string = 'Method Not Allowed') {
    super(405, message);
  }
}

// 408 Request Timeout
export class RequestTimeoutError extends AppException {
  constructor(message: string = 'Request timed out.') {
    super(408, message);
  }
}

// 413 Request Body Too Large
export class RequestBodyTooLargeError extends AppException {
  constructor(message: string = 'Request body too large') {
    super(413, message);
  }
}

// 415 Unsopoted Media Type
export class UnsupportedMediaTypeError extends AppException {
  constructor(message: string = 'Unsupported Media Type') {
    super(415, message);
  }
}

// 422 Unprocessable Content
export class ValidationErrorException extends AppException {
  constructor(errors: ValidationError[]) {
    const message: string = formatClassValidatorIssues(errors);
    super(422, message);
  }
}

export class UnprocessableContentError extends AppException {
  constructor(message: string = 'Unprocessable Content') {
    super(422, message);
  }
}

// 429 Too Many Requests
export class TooManyRequestsError extends AppException {
  constructor(message: string = 'Too many requests') {
    super(429, message);
  }
}

// 431 Request Header Fields Too Large
export class RequestHeaderFieldsTooLargeError extends AppException {
  constructor(message: string = 'Request header fields too large') {
    super(431, message);
  }
}

// 501 Not Implemented
export class UnsupportedTransferEncodingError extends AppException {
  constructor(message: string = 'Transfer-Encoding is not supported') {
    super(501, message);
  }
}
