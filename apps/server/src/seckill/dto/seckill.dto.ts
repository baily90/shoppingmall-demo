import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';

/** 查询抢购结果：凭 requestId 拉取异步落单结果 */
export class SeckillResultQueryDto {
  @IsString({ message: 'requestId 非法' })
  @MinLength(8, { message: 'requestId 非法' })
  @MaxLength(64, { message: 'requestId 非法' })
  requestId: string;
}

/** 抢购请求：指定活动的指定商品 */
export class GrabSeckillDto {
  @Type(() => Number)
  @IsInt({ message: '活动 id 非法' })
  activityId: number;

  @Type(() => Number)
  @IsInt({ message: '商品 id 非法' })
  skuId: number;
}

/** 管理端：活动列表查询（分页 + 状态过滤 + 名称关键字） */
export class ListSeckillActivityDto extends PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

export class CreateSeckillActivityDto {
  @IsString()
  @IsNotEmpty({ message: '活动名称不能为空' })
  @MaxLength(50, { message: '活动名称最多 50 字' })
  name: string;

  /** 活动起止（ISO 日期时间字符串） */
  @IsString()
  @IsNotEmpty({ message: '开始时间不能为空' })
  startTime: string;

  @IsString()
  @IsNotEmpty({ message: '结束时间不能为空' })
  endTime: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

export class UpdateSeckillActivityDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '开始时间不能为空' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '结束时间不能为空' })
  endTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}

/** 给活动加秒杀商品 */
export class SeckillSkuDto {
  @Type(() => Number)
  @IsInt({ message: '商品 id 非法' })
  skuId: number;

  @Type(() => Number)
  @IsInt({ message: '秒杀价必须为整数（分）' })
  @Min(1, { message: '秒杀价至少为 1 分' })
  seckillPrice: number;

  @Type(() => Number)
  @IsInt({ message: '秒杀库存必须为整数' })
  @Min(1, { message: '秒杀库存至少为 1' })
  seckillStock: number;
}

/** 改活动商品的秒杀价/库存 */
export class UpdateSeckillSkuDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '秒杀价必须为整数（分）' })
  @Min(1, { message: '秒杀价至少为 1 分' })
  seckillPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '秒杀库存必须为整数' })
  @Min(1, { message: '秒杀库存至少为 1' })
  seckillStock?: number;
}
