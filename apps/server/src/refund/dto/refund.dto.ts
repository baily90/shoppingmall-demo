import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';

/** 申请售后 */
export class ApplyRefundDto {
  @ApiProperty({ description: '订单 id' })
  @Type(() => Number)
  @IsInt({ message: '订单 id 非法' })
  orderId: number;

  @ApiProperty({ description: '申请原因（最多 200 字）' })
  @IsString()
  @IsNotEmpty({ message: '请选择申请原因' })
  @MaxLength(200, { message: '申请原因最多 200 字' })
  reason: string;

  @ApiPropertyOptional({ description: '补充说明（最多 500 字）' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '补充说明最多 500 字' })
  description?: string;
}

/** 商家审核：同意 / 拒绝 */
export class ReviewRefundDto {
  @ApiProperty({ description: '是否同意退款' })
  @IsBoolean({ message: 'approve 必须为布尔值' })
  approve: boolean;

  @ApiPropertyOptional({ description: '拒绝原因（approve=false 时填）' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '拒绝原因最多 200 字' })
  rejectReason?: string;
}

/** 买家填写退货物流 */
export class ShipBackDto {
  @ApiProperty({ description: '物流公司（最多 50 字）' })
  @IsString()
  @IsNotEmpty({ message: '物流公司不能为空' })
  @MaxLength(50, { message: '物流公司最多 50 字' })
  logisticsCompany: string;

  @ApiProperty({ description: '物流单号（最多 50 字）' })
  @IsString()
  @IsNotEmpty({ message: '物流单号不能为空' })
  @MaxLength(50, { message: '物流单号最多 50 字' })
  logisticsNo: string;
}

/** 售后列表查询：分页 + 状态过滤 + 售后单号关键字 */
export class ListRefundDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '售后状态' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  status?: number;
}
