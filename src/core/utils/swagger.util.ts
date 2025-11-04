import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

/**
 * @fileoverview
 * Centralized Swagger (OpenAPI) configuration and bootstrap helper.
 *
 * This module encapsulates the entire Swagger setup process,
 * keeping the `main.ts` file clean and ensuring consistent documentation
 * formatting across all QuickAPI-based services.
 *
 * ---
 * ### Purpose
 * - Generates an OpenAPI 3.0 document from NestJS decorators.
 * - Configures authentication, metadata, and UI presentation.
 * - Exposes a single `init()` method for simple integration.
 *
 * ---
 * ### Example Usage
 * ```ts
 * import { Swagger } from '@/config/swagger.config';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   Swagger.init(app, 'docs');
 *   await app.listen(3000);
 * }
 * ```
 *
 * Visit: http://localhost:3000/docs
 */
const CONFIG = new DocumentBuilder()
  /**
   * The title displayed at the top of the Swagger UI.
   */
  .setTitle('Nest API Example')

  /**
   * Human-readable description for the API documentation page.
   */
  .setDescription(
    'Minimal NestJS QuickAPI with validated environment config, structured logging, and DTO validation.',
  )

  /**
   * Current version of the API being served.
   */
  .setVersion('1.0.0')

  /**
   * Adds Bearer (JWT) authentication support to all secured endpoints.
   *
   * This allows developers to authorize requests via Swagger UI's
   * built-in "Authorize" dialog.
   *
   * The `name` parameter ('access-token') is used by the `@ApiBearerAuth()` decorator.
   */
  .addBearerAuth(
    {
      description: 'Default JWT Authorization',
      type: 'http',
      in: 'header',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'access-token',
  )

  /**
   * Finalizes and builds the document configuration.
   */
  .build();

/**
 * Static helper class for initializing Swagger documentation
 * within any NestJS application context.
 *
 * The `init()` method can be safely called from `main.ts` or from
 * any bootstrap environment (HTTP, microservice, etc.).
 */
export class Swagger {
  /**
   * Initializes Swagger UI and exposes API documentation.
   *
   * @param app - The active Nest application instance.
   * @param prefix - The URL path where Swagger UI will be served (e.g., `'docs'` → `/docs`).
   *
   * ---
   * ### Example
   * ```ts
   * Swagger.init(app, 'docs');
   * ```
   */
  public static init(app: INestApplication, prefix: string): void {
    const document = SwaggerModule.createDocument(app, CONFIG);
    SwaggerModule.setup(`/${prefix}`, app, document);
  }
}
