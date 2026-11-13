import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';

/** 管理端：券列表查询（分页 + 状态过滤 + 名称关键字） */
export class ListCouponDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

export class CreateCouponDto {
  @ApiProperty({ description: '券名称（最多 50 字）', example: '满 100 减 20' })
  @IsString()
  @IsNotEmpty({ message: '券名称不能为空' })
  @MaxLength(50, { message: '券名称最多 50 字' })
  name: string;

  @ApiProperty({ description: '券类型：1 满减 / 2 折扣', example: 1 })
  @Type(() => Number)
  @IsInt({ message: '券类型必须为整数' })
  @IsIn([1, 2], { message: '券类型只能为 1(满减) 或 2(折扣)' })
  type: number;

  /** 使用门槛（分），0=无门槛 */
  @ApiPropertyOptional({ description: '使用门槛金额（分），0=无门槛' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '门槛金额必须为整数（分）' })
  @Min(0, { message: '门槛金额不能为负' })
  thresholdAmount?: number;

  /** 减免金额（分），满减券用 */
  @ApiPropertyOptional({ description: '减免金额（分），满减券用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '减免金额必须为整数（分）' })
  @Min(0, { message: '减免金额不能为负' })
  discountAmount?: number;

  /** 折扣率（如 85=85 折），折扣券用 */
  @ApiPropertyOptional({ description: '折扣率（如 85=85 折），折扣券用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '折扣率必须为整数' })
  @Min(1, { message: '折扣率最小为 1 折' })
  @Max(99, { message: '折扣率最大为 99 折' })
  discountRate?: number;

  @ApiProperty({ description: '发行总量（张）' })
  @Type(() => Number)
  @IsInt({ message: '发行总量必须为整数' })
  @Min(1, { message: '发行总量至少为 1' })
  totalStock: number;

  /** 每人限领张数，0=不限 */
  @ApiPropertyOptional({ description: '每人限领张数，0=不限' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每人限领必须为整数' })
  @Min(0, { message: '每人限领不能为负' })
  perUserLimit?: number;

  /** 有效期起止（ISO 日期时间字符串） */
  @ApiProperty({ description: '有效期开始时间（ISO 日期时间）', example: '2026-01-01T00:00:00Z' })
  @IsString()
  @IsNotEmpty({ message: '开始时间不能为空' })
  startTime: string;

  @ApiProperty({ description: '有效期结束时间（ISO 日期时间）', example: '2026-12-31T23:59:59Z' })
  @IsString()
  @IsNotEmpty({ message: '结束时间不能为空' })
  endTime: string;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;

  @ApiPropertyOptional({ description: '说明（最多 200 字）' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '说明最多 200 字' })
  description?: string;
}

/** 编辑券：全部可选；发行总量在发放后不允许修改（防止缩到已领取数之下） */
export class UpdateCouponDto {
  @ApiPropertyOptional({ description: '券名称' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: '券类型：1 满减 / 2 折扣' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  type?: number;

  @ApiPropertyOptional({ description: '使用门槛金额（分）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  thresholdAmount?: number;

  @ApiPropertyOptional({ description: '减免金额（分）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: '折扣率（85=85 折）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  discountRate?: number;

  @ApiPropertyOptional({ description: '每人限领张数' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  perUserLimit?: number;

  @ApiPropertyOptional({ description: '有效期开始时间' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '开始时间不能为空' })
  startTime?: string;

  @ApiPropertyOptional({ description: '有效期结束时间' })
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

  @ApiPropertyOptional({ description: '说明' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
