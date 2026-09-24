import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 业务异常：携带业务错误码（见 docs/03 统一规范）
 */
export class BusinessException extends HttpException {
  constructor(code: number, message: string, httpStatus: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ code, message }, httpStatus);
  }
}
