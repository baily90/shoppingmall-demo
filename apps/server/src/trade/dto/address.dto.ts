import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 收货地址（省市区分三段存储，下单时拼接成完整地址快照进订单） */
export class CreateAddressDto {
  @IsString()
  @IsNotEmpty({ message: '收货人不能为空' })
  @MaxLength(30, { message: '收货人最多 30 字' })
  receiverName: string;

  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @MaxLength(20, { message: '手机号最多 20 字' })
  receiverPhone: string;

  @IsString()
  @IsNotEmpty({ message: '省份不能为空' })
  @MaxLength(30)
  province: string;

  @IsString()
  @IsNotEmpty({ message: '城市不能为空' })
  @MaxLength(30)
  city: string;

  @IsString()
  @IsNotEmpty({ message: '区县不能为空' })
  @MaxLength(30)
  district: string;

  @IsString()
  @IsNotEmpty({ message: '详细地址不能为空' })
  @MaxLength(200, { message: '详细地址最多 200 字' })
  detail: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: 'isDefault 只能为 0 或 1' })
  isDefault?: number;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  receiverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  receiverPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  detail?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: 'isDefault 只能为 0 或 1' })
  isDefault?: number;
}
