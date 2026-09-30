import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
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
}

/** 订单列表查询：分页 + 状态过滤（keyword 用于订单号搜索） */
export class ListOrderDto extends PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  status?: number;
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
