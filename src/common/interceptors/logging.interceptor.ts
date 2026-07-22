import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const start = Date.now(); // timestamp bắt đầu xử lý

    // Phần "before": log khi request đến
    this.logger.log(`→ ${method} ${url} [${ip}] ${userAgent}`);

    return next.handle().pipe(
      // tap(): thực hiện side effect (hiệu ứng phụ) mà không thay đổi data
      // Phần "after": log sau khi handler xử lý xong
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const duration = Date.now() - start; // tổng thời gian xử lý
        this.logger.log(
          `← ${method} ${url} ${response.statusCode} [${duration}ms]`,
        );
      }),
    );
  }
}
