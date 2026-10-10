import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';
import { MAX_REVIEW_IMAGES, REVIEW_RATING_MAX, REVIEW_RATING_MIN } from '../review.constant';

/** 提交商品评价（按订单项） */
export class CreateReviewDto {
  @Type(() => Number)
  @IsInt({ message: '订单 id 非法' })
  orderId: number;

  @Type(() => Number)
  @IsInt({ message: '订单项 id 非法' })
  orderItemId: number;

  @Type(() => Number)
  @IsInt({ message: '评分必须为整数' })
  @Min(REVIEW_RATING_MIN, { message: '评分最低 1 星' })
  @Max(REVIEW_RATING_MAX, { message: '评分最高 5 星' })
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '评价内容最多 500 字' })
  content?: string;

  @IsOptional()
  @IsArray({ message: '评价图片必须是数组' })
  @ArrayMaxSize(MAX_REVIEW_IMAGES, { message: `评价图片最多 ${MAX_REVIEW_IMAGES} 张` })
  @IsString({ each: true, message: '图片 URL 必须为字符串' })
  images?: string[];

  @IsOptional()
  @IsBoolean({ message: 'anonymous 必须为布尔值' })
  anonymous?: boolean;
}

/**
 * 商品评价公开列表查询：只做分页（商品 id 走路由参数，@Param 已解析），
 * 无需在 query 里再声明 productId，否则会被误判为缺失。
 */
export class ListReviewQueryDto extends PageQueryDto {}

/** 管理端评价列表查询：分页 + 状态/评分/商品过滤 + 关键字 */
export class AdminListReviewDto extends PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '评分必须为整数' })
  rating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '商品 id 必须为整数' })
  productId?: number;
}

/** 管理端设置评价展示状态（屏蔽/恢复） */
export class SetReviewStatusDto {
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  status: number;
}
