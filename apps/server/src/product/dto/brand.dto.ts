import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';

/** 商城端品牌列表查询：分页 + 可选「按分类过滤（含后代）」 */
export class StoreBrandQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '分类 id（含后代分类）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '分类 id 必须为整数' })
  categoryId?: number;
}

export class CreateBrandDto {
  @ApiProperty({ description: '品牌名称（最多 30 字）', example: '华为' })
  @IsString()
  @IsNotEmpty({ message: '品牌名称不能为空' })
  @MaxLength(30, { message: '品牌名称最多 30 字' })
  name: string;

  @ApiPropertyOptional({ description: 'logo 图片地址' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'logo 地址最多 200 字' })
  logo?: string;

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

export class UpdateBrandDto {
  @ApiPropertyOptional({ description: '品牌名称（最多 30 字）' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  name?: string;

  @ApiPropertyOptional({ description: 'logo 图片地址' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  logo?: string;

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
