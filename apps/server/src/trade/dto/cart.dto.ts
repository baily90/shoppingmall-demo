import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ description: 'SKU id', example: 1 })
  @IsInt({ message: 'SKU id 必须为整数' })
  skuId: number;

  @ApiPropertyOptional({ description: '数量', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1, { message: '数量至少为 1' })
  quantity?: number;
}

export class UpdateCartItemDto {
  @ApiPropertyOptional({ description: '数量（至少 1）' })
  @IsOptional()
  @IsInt()
  @Min(1, { message: '数量至少为 1' })
  quantity?: number;

  @ApiPropertyOptional({ description: '是否选中：1 是 / 0 否' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: 'selected 只能为 0 或 1' })
  selected?: number;
}
