import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';

/** 申请售后 */
export class ApplyRefundDto {
  @Type(() => Number)
  @IsInt({ message: '订单 id 非法' })
  orderId: number;

  @IsString()
  @IsNotEmpty({ message: '请选择申请原因' })
  @MaxLength(200, { message: '申请原因最多 200 字' })
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '补充说明最多 500 字' })
  description?: string;
}

/** 商家审核：同意 / 拒绝 */
export class ReviewRefundDto {
  @IsBoolean({ message: 'approve 必须为布尔值' })
  approve: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '拒绝原因最多 200 字' })
  rejectReason?: string;
}

/** 买家填写退货物流 */
export class ShipBackDto {
  @IsString()
  @IsNotEmpty({ message: '物流公司不能为空' })
  @MaxLength(50, { message: '物流公司最多 50 字' })
  logisticsCompany: string;

  @IsString()
  @IsNotEmpty({ message: '物流单号不能为空' })
  @MaxLength(50, { message: '物流单号最多 50 字' })
  logisticsNo: string;
}

/** 售后列表查询：分页 + 状态过滤 + 售后单号关键字 */
export class ListRefundDto extends PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  status?: number;
}
