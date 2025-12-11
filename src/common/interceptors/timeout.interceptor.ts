import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestTimeoutError } from '../exceptions/http.exception';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly ms: number = 5000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http: HttpArgumentsHost = context.switchToHttp();
    const res = http.getResponse();
    const timer: NodeJS.Timeout = setTimeout(() => {
      if (!res.headersSent) {
        throw new RequestTimeoutError(`Request timed out after ${this.ms}ms`);
      }
    }, this.ms);

    res.on('finish', () => clearTimeout(timer));

    return next.handle();
  }
}
