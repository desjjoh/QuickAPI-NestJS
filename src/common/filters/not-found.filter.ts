import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global.filter';

@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    // Preserve intentional resource-not-found messages; do not echo URLs,
    // query tokens or personal path values in framework-generated 404s.
    const raw = exception.message;
    const message = /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /.test(
      raw,
    )
      ? 'Route not found.'
      : raw;
    new GlobalExceptionFilter().catch(new NotFoundException(message), host);
  }
}
