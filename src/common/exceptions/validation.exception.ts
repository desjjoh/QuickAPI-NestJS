import type { ValidationError } from 'class-validator';
import { HttpException, HttpStatus } from '@nestjs/common';

export function formatClassValidatorIssues(errors: ValidationError[]): string {
  const messages: string[] = [];

  function walk(err: ValidationError) {
    if (err.constraints) {
      messages.push(
        ...Object.values(err.constraints).map(
          (msg) => `${err.property} → ${msg}`,
        ),
      );
    }

    if (err.children?.length) {
      err.children.forEach(walk);
    }
  }

  errors.forEach(walk);

  return `Validation failed: ${messages.join('; ')}.`;
}

export class ValidationException extends HttpException {
  readonly timestamp: string;

  constructor(
    errors: ValidationError[],
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    const message = formatClassValidatorIssues(errors);

    super({ message }, status);

    this.timestamp = new Date().toISOString();
  }
}
