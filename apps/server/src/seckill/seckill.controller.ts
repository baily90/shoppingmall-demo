import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserJwtAuthGuard } from '../common/guards/user-jwt-auth.guard';
import { CurrentUser, UserContext } from '../common/decorators/current-user.decorator';
import { SeckillService } from './seckill.service';
import { GrabSeckillDto, SeckillResultQueryDto } from './dto/seckill.dto';

@Controller('seckill')
export class SeckillController {
  constructor(private readonly seckillService: SeckillService) {}

  /** 秒杀专区（公开）：启用且未结束的活动 + 各活动秒杀商品卡 */
  @Get('activities')
  activities() {
    return this.seckillService.listActivities();
  }

  /** 抢购：高频入口，单独收紧限流（后续「防刷」阶段再加强） */
  @UseGuards(UserJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 1_000 } })
  @Post('grab')
  grab(@CurrentUser() user: UserContext, @Body() dto: GrabSeckillDto) {
    return this.seckillService.grab(user.id, dto.activityId, dto.skuId);
  }

  /** 查询抢购结果 */
  @UseGuards(UserJwtAuthGuard)
  @Get('result')
  result(@Query() query: SeckillResultQueryDto) {
    return this.seckillService.queryResult(query.requestId);
  }
}
