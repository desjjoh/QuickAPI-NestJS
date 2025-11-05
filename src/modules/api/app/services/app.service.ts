import { Injectable } from '@nestjs/common';

/**
 * @fileoverview
 * Core application service providing foundational logic for the root module.
 *
 * This service currently acts as a simple demonstration of dependency injection
 * and service layering in NestJS. While trivial in implementation, it represents
 * the standard pattern used across all feature modules — controllers delegate
 * logic to injectable services, which encapsulate reusable application behavior.
 *
 * ---
 * ### Purpose
 * - Provide a basic "Hello World" response for the root controller.
 * - Serve as a template for creating future service classes.
 * - Illustrate the `@Injectable()` decorator and NestJS DI mechanism.
 *
 * ---
 * ### Example Usage
 * ```ts
 * import { AppService } from '@/api/app/services/app.service';
 *
 * @Controller()
 * export class AppController {
 *   constructor(private readonly appService: AppService) {}
 *
 *   @Get()
 *   getHello(): string {
 *     return this.appService.getHello();
 *   }
 * }
 * ```
 */
@Injectable()
export class AppService {
  /**
   * Returns a static greeting message.
   *
   * This is primarily used by {@link AppController.getHello} to verify
   * that the application is responsive.
   *
   * @returns A string containing a short greeting message.
   *
   * ---
   * ### Example Response
   * ```json
   * "Hello World!"
   * ```
   */
  getHello(): string {
    return 'Hello World!';
  }
}
