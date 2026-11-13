import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

// 按用户限流：getTracker 返回 user:{userId}（未鉴权时回退 ip:{ip}）
// 用法：@UseGuards(UserJwtGuard, UserThrottlerGuard) —— 顺序保证先鉴权（挂 userId）再限流
//
// 注意：tsx(esbuild) 不发射 design:paramtypes，构造注入必须显式 @Inject。
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
  }
}
