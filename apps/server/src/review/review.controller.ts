import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserJwtAuthGuard } from '../common/guards/user-jwt-auth.guard';
import { CurrentUser, UserContext } from '../common/decorators/current-user.decorator';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/review.dto';
import { PageQueryDto } from '../common/dto/query.dto';

@UseGuards(UserJwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(user.id, dto);
  }

  /** 我的评价列表（含已屏蔽，让用户能看到自己评价的状态） */
  @Get('mine')
  listMine(@CurrentUser() user: UserContext, @Query() query: PageQueryDto) {
    return this.reviewService.listMine(user.id, query);
  }
}
