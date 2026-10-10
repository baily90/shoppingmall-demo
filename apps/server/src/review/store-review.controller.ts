import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ListReviewQueryDto } from './dto/review.dto';
import { OptionalUserJwtGuard } from '../common/guards/optional-user-jwt.guard';
import { CurrentUser, UserContext } from '../common/decorators/current-user.decorator';

/** 商城端公开接口：商品评价列表（无需登录；带 token 时识别当前用户，标记 mine） */
@Controller('products')
export class StoreReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @UseGuards(OptionalUserJwtGuard)
  @Get(':productId/reviews')
  list(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() query: ListReviewQueryDto,
    @CurrentUser() user?: UserContext,
  ) {
    return this.reviewService.listByProduct(productId, query, user?.id);
  }
}
