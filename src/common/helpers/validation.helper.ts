import { ValidationError } from 'class-validator';

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
