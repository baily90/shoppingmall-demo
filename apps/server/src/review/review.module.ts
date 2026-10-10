import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { StoreReviewController } from './store-review.controller';
import { AdminReviewController } from './admin-review.controller';
import { ReviewService } from './review.service';

@Module({
  controllers: [ReviewController, StoreReviewController, AdminReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
