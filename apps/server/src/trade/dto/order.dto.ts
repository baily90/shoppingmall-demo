import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';

export class CreateOrderItemDto {
  @IsInt({ message: 'SKU id 必须为整数' })
  skuId: number;

  @IsInt({ message: '数量必须为整数' })
  @Min(1, { message: '数量至少为 1' })
  quantity: number;
}

export class CreateOrderDto {
  @IsArray({ message: '商品必须是数组' })
  @ArrayNotEmpty({ message: '订单商品不能为空' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsInt({ message: '地址 id 必须为整数' })
  addressId: number;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '备注最多 200 字' })
  remark?: string;

  /** 幂等键：同一 key 重复提交（如双击）只建一单，防重复下单 */
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: '幂等键最多 64 字' })
  idempotencyKey?: string;

  /** 选用的用户券 id（UserCoupon.id，一单一券），不传则不使用优惠 */
  @IsOptional()
  @IsInt({ message: '优惠券 id 必须为整数' })
  couponId?: number;
}

/** 订单列表查询：分页 + 状态过滤（keyword 用于订单号搜索） */
export class ListOrderDto extends PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  status?: number;

  /**
   * 是否按「进行中售后」过滤：true 只看有进行中售后的（退款/售后 tab），
   * false 只看无进行中售后的（待发货/待收货 tab 要排除售后中的订单）。
   * 用 @Transform 手动解析，避免 Boolean('false') === true 的坑。
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'refundActive 必须为布尔值' })
  refundActive?: boolean;
}

export class ShipOrderDto {
  @IsString()
  @IsNotEmpty({ message: '物流公司不能为空' })
  @MaxLength(50, { message: '物流公司最多 50 字' })
  logisticsCompany: string;

  @IsString()
  @IsNotEmpty({ message: '物流单号不能为空' })
  @MaxLength(50, { message: '物流单号最多 50 字' })
  logisticsNo: string;
}
