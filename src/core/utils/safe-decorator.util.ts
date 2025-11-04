import type { ValidationOptions } from 'class-validator';

/**
 * @fileoverview Utility for safely wrapping `class-validator` decorators
 * to prevent false-positive ESLint warnings such as
 * `@typescript-eslint/no-unsafe-call`.
 *
 * This helper ensures decorators are explicitly typed as
 * `(options?: ValidationOptions) => PropertyDecorator`,
 * allowing strict type-aware linting without disabling rules globally.
 *
 * ---
 * ### Why this exists
 * TypeScript's decorator typing is intentionally broad (`(...args: any[]) => void`).
 * When `@typescript-eslint` runs in type-aware mode, it flags these decorators
 * as "unsafe" calls because their parameter types are `any`.
 *
 * Wrapping them in this helper constrains the type signature and silences
 * that false-positive without muting safety elsewhere.
 *
 * ---
 * ### Example
 * ```ts
 * import { IsString, Min, Length } from 'class-validator';
 * import { safeDecorator } from '@/shared/validation/safe-decorator.util';
 *
 * const SafeIsString = safeDecorator(IsString);
 * const SafeMin = safeDecorator(Min);
 * const SafeLength = safeDecorator(Length);
 *
 * export class CreateItemDto {
 *   @SafeIsString()
 *   @SafeLength(3, 120)
 *   name!: string;
 *
 *   @SafeMin(0)
 *   price!: number;
 * }
 * ```
 *
 * ---
 * ### Benefits
 * - Keeps `@typescript-eslint/no-unsafe-call` enabled project-wide.
 * - Avoids noisy local disables (`// eslint-disable-next-line`).
 * - 100% runtime-compatible with `class-validator`.
 * - Zero overhead — returns the original decorator reference.
 */

/**
 * Wraps a `class-validator` decorator function with a strongly typed signature.
 *
 * @template T - Any function returning a `PropertyDecorator`
 * that optionally accepts `ValidationOptions` or other parameters.
 *
 * @param decorator - The original `class-validator` decorator function.
 * @returns The same decorator function with safe type constraints applied.
 */
export function safeDecorator<T extends (...args: any[]) => PropertyDecorator>(
  decorator: T,
): T {
  return decorator;
}

/**
 * Typed specialization for standard validation decorators that
 * accept only `ValidationOptions`.
 *
 * This variant provides more specific typing for simple decorators like:
 * `@IsString()`, `@IsBoolean()`, `@IsInt()`, etc.
 *
 * @example
 * ```ts
 * const SafeIsString = safeValidationDecorator(IsString);
 * const SafeIsBoolean = safeValidationDecorator(IsBoolean);
 * ```
 */
export function safeValidationDecorator(
  decorator: (options?: ValidationOptions) => PropertyDecorator,
): (options?: ValidationOptions) => PropertyDecorator {
  return decorator;
}
