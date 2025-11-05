import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from '@/api/app/services/app.service';

/**
 * @fileoverview
 * Root application controller providing a basic health or greeting endpoint.
 *
 * While minimal, this controller demonstrates the standard NestJS controller
 * pattern — dependency injection via constructor, request mapping with decorators,
 * and typed route handlers.
 *
 * ---
 * ### Purpose
 * - Acts as the application's default route (`GET /`).
 * - Serves as a sanity check for verifying the API is running.
 * - Illustrates standard NestJS controller structure for new modules.
 *
 * ---
 * ### Example Request
 * ```http
 * GET /
 * ```
 *
 * ### Example Response
 * ```json
 * "Hello, world!"
 * ```
 */
@ApiTags('root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Handles the root GET endpoint (`/`).
   *
   * Delegates response generation to {@link AppService.getHello},
   * returning a simple greeting message.
   *
   * @returns A short greeting or service health message.
   *
   * ---
   * ### Example Response
   * ```json
   * "Hello, world!"
   * ```
   */
  @Get()
  @ApiOperation({ summary: 'Default greeting endpoint' })
  @ApiOkResponse({
    description: 'Returns a static greeting or health message.',
    type: String,
    example: 'Hello, world!',
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
