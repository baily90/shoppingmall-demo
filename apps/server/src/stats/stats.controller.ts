import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { StatsService } from './stats.service';

/**
 * 数据看板：管理端首页，所有登录管理员可见（不按细粒度权限控制，只要求登录）。
 */
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview() {
    return this.statsService.overview();
  }
}
