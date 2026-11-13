import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ description: '抢购请求 id（8-64 位）' })
  @IsString({ message: 'requestId 非法' })
  @MinLength(8, { message: 'requestId 非法' })
  @MaxLength(64, { message: 'requestId 非法' })
  requestId: string;
}

/** 抢购请求：指定活动的指定商品 */
export class GrabSeckillDto {
  @ApiProperty({ description: '秒杀活动 id' })
  @Type(() => Number)
  @IsInt({ message: '活动 id 非法' })
  activityId: number;

  @ApiProperty({ description: 'SKU id' })
  @Type(() => Number)
  @IsInt({ message: '商品 id 非法' })
  skuId: number;
}

/** 管理端：活动列表查询（分页 + 状态过滤 + 名称关键字） */
export class ListSeckillActivityDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

export class CreateSeckillActivityDto {
  @ApiProperty({ description: '活动名称（最多 50 字）', example: '双 11 秒杀' })
  @IsString()
  @IsNotEmpty({ message: '活动名称不能为空' })
  @MaxLength(50, { message: '活动名称最多 50 字' })
  name: string;

  /** 活动起止（ISO 日期时间字符串） */
  @ApiProperty({ description: '开始时间（ISO 日期时间）', example: '2026-01-01T00:00:00Z' })
  @IsString()
  @IsNotEmpty({ message: '开始时间不能为空' })
  startTime: string;

  @ApiProperty({ description: '结束时间（ISO 日期时间）', example: '2026-01-02T00:00:00Z' })
  @IsString()
  @IsNotEmpty({ message: '结束时间不能为空' })
  endTime: string;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

export class UpdateSeckillActivityDto {
  @ApiPropertyOptional({ description: '活动名称' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '开始时间不能为空' })
  startTime?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '结束时间不能为空' })
  endTime?: string;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}

/** 给活动加秒杀商品 */
export class SeckillSkuDto {
  @ApiProperty({ description: 'SKU id' })
  @Type(() => Number)
  @IsInt({ message: '商品 id 非法' })
  skuId: number;

  @ApiProperty({ description: '秒杀价（分）' })
  @Type(() => Number)
  @IsInt({ message: '秒杀价必须为整数（分）' })
  @Min(1, { message: '秒杀价至少为 1 分' })
  seckillPrice: number;

  @ApiProperty({ description: '秒杀库存' })
  @Type(() => Number)
  @IsInt({ message: '秒杀库存必须为整数' })
  @Min(1, { message: '秒杀库存至少为 1' })
  seckillStock: number;
}

/** 改活动商品的秒杀价/库存 */
export class UpdateSeckillSkuDto {
  @ApiPropertyOptional({ description: '秒杀价（分）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '秒杀价必须为整数（分）' })
  @Min(1, { message: '秒杀价至少为 1 分' })
  seckillPrice?: number;

  @ApiPropertyOptional({ description: '秒杀库存' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '秒杀库存必须为整数' })
  @Min(1, { message: '秒杀库存至少为 1' })
  seckillStock?: number;
}
