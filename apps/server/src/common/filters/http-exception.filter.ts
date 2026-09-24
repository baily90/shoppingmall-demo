import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 50000;
    let message: string | string[] = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as
        string | { code?: number; message?: string | string[] };

      if (typeof res === 'string') {
        message = res;
        code = status;
      } else {
        message = res.message ?? exception.message;
        code = res.code ?? status;
      }
      // class-validator 的校验错误 message 是数组，取第一条
      if (Array.isArray(message)) {
        message = message[0];
      }
    } else {
      this.logger.error(exception);
    }

    response.status(status).json({ code, data: null, message });
  }
}
