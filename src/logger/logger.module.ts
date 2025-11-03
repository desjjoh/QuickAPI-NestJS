import { Module, Global } from '@nestjs/common';
import { AppLogger } from './services/logger.service';

/**
 * Global Logging Module
 *
 * Provides a centralized, application-wide logging service using the {@link AppLogger}.
 *
 * This module is marked as `@Global()`, meaning the logger can be injected into
 * any provider, controller, or service without explicitly importing this module
 * in each feature module.
 *
 * ---
 * ### Example
 * ```ts
 * import { Injectable } from '@nestjs/common';
 * import { AppLogger } from '@/logger/services/logger.service';
 *
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly logger: AppLogger) {}
 *
 *   async createUser(data: CreateUserDto) {
 *     this.logger.log('Creating new user', { context: UserService.name });
 *     // ...
 *   }
 * }
 * ```
 *
 * ---
 * ### Nest Integration
 * To enable the global logger, simply import this module in your root module:
 * ```ts
 * import { Module } from '@nestjs/common';
 * import { AppLoggerModule } from '@/logger/app-logger.module';
 *
 * @Module({
 *   imports: [AppLoggerModule],
 * })
 * export class AppModule {}
 * ```
 *
 * Once registered, you can also set it as the primary Nest logger:
 * ```ts
 * const app = await NestFactory.create(AppModule, { bufferLogs: true });
 * app.useLogger(app.get(AppLogger));
 * ```
 *
 * ---
 * ### Notes
 * - Automatically exposes a single shared instance of {@link AppLogger}.
 * - No configuration required; respects the `LOG_LEVEL` environment variable.
 * - Ensures consistent formatting and timestamping across all logs in the system.
 */
@Global()
@Module({
  providers: [AppLogger],
  exports: [AppLogger],
})
export class AppLoggerModule {}
