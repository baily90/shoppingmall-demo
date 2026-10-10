import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentAdmin, AdminContext } from '../common/decorators/current-user.decorator';
import { ReviewService } from './review.service';
import { AdminListReviewDto, ReplyDto, SetReviewStatusDto } from './dto/review.dto';

@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Controller('admin/reviews')
export class AdminReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @Permissions('review:list')
  list(@Query() query: AdminListReviewDto) {
    return this.reviewService.adminList(query);
  }

  @Post(':id/status')
  @Permissions('review:block')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetReviewStatusDto) {
    return this.reviewService.adminSetStatus(id, dto);
  }

  @Post(':id/reply')
  @Permissions('review:reply')
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyDto,
    @CurrentAdmin() admin: AdminContext,
  ) {
    return this.reviewService.adminReply(id, dto, admin.id);
  }
}
