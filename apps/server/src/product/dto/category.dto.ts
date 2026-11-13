import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: '分类名称（最多 30 字）', example: '手机数码' })
  @IsString()
  @IsNotEmpty({ message: '分类名称不能为空' })
  @MaxLength(30, { message: '分类名称最多 30 字' })
  name: string;

  @ApiPropertyOptional({ description: '父级分类 id（顶级分类不传）' })
  @IsOptional()
  @IsInt({ message: '父级分类 id 必须为整数' })
  parentId?: number;

  @ApiPropertyOptional({ description: '图标地址' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '图标地址最多 200 字' })
  icon?: string;

  @ApiPropertyOptional({ description: '排序值（越小越靠前）' })
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用', default: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: '分类名称（最多 30 字）' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  name?: string;

  @ApiPropertyOptional({ description: '图标地址' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  icon?: string;

  @ApiPropertyOptional({ description: '排序值（越小越靠前）' })
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}
