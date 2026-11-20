// 全局异常过滤：统一错误响应，避免把内部堆栈/供应商错误透给前端
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务暂时不可用，请稍后再试';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object' && 'message' in res) {
        const value = (res as { message?: string | string[] }).message;
        message = Array.isArray(value) ? value[0] : value || exception.message;
      } else {
        message = exception.message;
      }
    } else {
      this.logger.error(exception);
    }

    // 流式响应可能已经开始，不能再写 JSON
    if (response.headersSent) {
      response.end();
      return;
    }
    response.status(status).json({ error: message });
  }
}
