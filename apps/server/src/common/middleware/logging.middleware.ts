import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const TRACE_HEADER = 'x-request-id';

/**
 * 请求日志中间件：记录每次请求的方法、路径、状态码、耗时，并带上 traceId。
 * - traceId：优先复用上游传来的 x-request-id，否则为本次请求新生成一个；
 *   既写进响应头回给前端，也回写 request，方便按「一次请求」串联日志。
 */
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const traceId = (req.headers[TRACE_HEADER] as string | undefined) || randomUUID();
    req.headers[TRACE_HEADER] = traceId; // 回写，供下游/服务内复用
    res.setHeader(TRACE_HEADER, traceId); // 响应头带回去，前端可按此定位

    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      this.logger.log(`[${traceId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  }
}
