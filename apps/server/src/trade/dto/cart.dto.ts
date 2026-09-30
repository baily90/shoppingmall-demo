import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class AddCartItemDto {
  @IsInt({ message: 'SKU id 必须为整数' })
  skuId: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: '数量至少为 1' })
  quantity?: number;
}

export class UpdateCartItemDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: '数量至少为 1' })
  quantity?: number;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: 'selected 只能为 0 或 1' })
  selected?: number;
}
