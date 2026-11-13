import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 收货地址（省市区分三段存储，下单时拼接成完整地址快照进订单） */
export class CreateAddressDto {
  @ApiProperty({ description: '收货人姓名（最多 30 字）', example: '张三' })
  @IsString()
  @IsNotEmpty({ message: '收货人不能为空' })
  @MaxLength(30, { message: '收货人最多 30 字' })
  receiverName: string;

  @ApiProperty({ description: '收货人手机号', example: '13800000001' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @MaxLength(20, { message: '手机号最多 20 字' })
  receiverPhone: string;

  @ApiProperty({ description: '省份' })
  @IsString()
  @IsNotEmpty({ message: '省份不能为空' })
  @MaxLength(30)
  province: string;

  @ApiProperty({ description: '城市' })
  @IsString()
  @IsNotEmpty({ message: '城市不能为空' })
  @MaxLength(30)
  city: string;

  @ApiProperty({ description: '区县' })
  @IsString()
  @IsNotEmpty({ message: '区县不能为空' })
  @MaxLength(30)
  district: string;

  @ApiProperty({ description: '详细地址（最多 200 字）' })
  @IsString()
  @IsNotEmpty({ message: '详细地址不能为空' })
  @MaxLength(200, { message: '详细地址最多 200 字' })
  detail: string;

  @ApiPropertyOptional({ description: '是否默认：1 是 / 0 否', default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: 'isDefault 只能为 0 或 1' })
  isDefault?: number;
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ description: '收货人姓名' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  receiverName?: string;

  @ApiPropertyOptional({ description: '收货人手机号' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  receiverPhone?: string;

  @ApiPropertyOptional({ description: '省份' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  province?: string;

  @ApiPropertyOptional({ description: '城市' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  city?: string;

  @ApiPropertyOptional({ description: '区县' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  district?: string;

  @ApiPropertyOptional({ description: '详细地址' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  detail?: string;

  @ApiPropertyOptional({ description: '是否默认：1 是 / 0 否' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: 'isDefault 只能为 0 或 1' })
  isDefault?: number;
}
