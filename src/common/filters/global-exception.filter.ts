import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// @Catch() không truyền tham số = bắt TẤT CẢ exception
// Kể cả lỗi không phải HttpException (lỗi DB, null pointer...)
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  // Logger: ghi log lỗi với context là tên class
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // ArgumentsHost: abstraction của request context
    // switchToHttp(): chuyển về HTTP context để lấy req/res
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Xác định HTTP status code
    // Nếu là HttpException (BadRequest, NotFound...) → lấy status của nó
    // Nếu là lỗi khác (DB crash, null pointer...) → 500 Internal Server Error
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Lấy message lỗi
    let message: string | string[];
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      // ValidationPipe ném lỗi dạng { message: ['email must be...', 'name must be...'] }
      // Các HttpException khác ném dạng string
      message =
        typeof exceptionResponse === 'object' && 'message' in exceptionResponse
          ? (exceptionResponse as any).message
          : exception.message;
    } else {
      message = 'Internal server error';
      // Log lỗi nghiêm trọng không phải HttpException
      this.logger.error(
        `Unexpected error: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Format response lỗi thống nhất cho toàn bộ app
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,          // URL đang request — dễ debug
      method: request.method,     // HTTP method
    });
  }
}
