import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Interface định nghĩa format response chuẩn của toàn app
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    // next.handle(): gọi route handler thật → trả về Observable
    // map(): transform data khi Observable emit (phát ra giá trị)
    // Phần "after" của interceptor — chạy SAU khi handler xử lý xong
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,                              // data thật từ handler
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
