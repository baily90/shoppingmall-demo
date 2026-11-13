import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';

/** 商品列表查询：分页 + 分类/品牌/状态过滤 */
export class ListProductDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '分类 id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '分类 id 必须为整数' })
  categoryId?: number;

  @ApiPropertyOptional({ description: '品牌 id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '品牌 id 必须为整数' })
  brandId?: number;

  @ApiPropertyOptional({ description: '状态：0 下架 / 1 上架' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

/** 规格组：一个组名 + 一组规格值 */
export class CreateSpecGroupDto {
  @ApiProperty({ description: '规格组名称（如「颜色」）' })
  @IsString()
  @IsNotEmpty({ message: '规格组名称不能为空' })
  @MaxLength(30, { message: '规格组名称最多 30 字' })
  name: string;

  @ApiProperty({ description: '规格值列表（如 [「红」,「蓝」]）', type: [String] })
  @IsArray({ message: '规格值必须是数组' })
  @ArrayNotEmpty({ message: '规格值不能为空' })
  @IsString({ each: true, message: '规格值必须为字符串' })
  values: string[];
}

export class CreateProductDto {
  @ApiProperty({ description: '商品名称（最多 100 字）', example: 'iPhone 15' })
  @IsString()
  @IsNotEmpty({ message: '商品名称不能为空' })
  @MaxLength(100, { message: '商品名称最多 100 字' })
  name: string;

  @ApiPropertyOptional({ description: '副标题（最多 200 字）' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subTitle?: string;

  @ApiProperty({ description: '分类 id' })
  @IsInt({ message: '分类 id 必须为整数' })
  categoryId: number;

  @ApiProperty({ description: '品牌 id' })
  @IsInt({ message: '品牌 id 必须为整数' })
  brandId: number;

  @ApiProperty({ description: '主图地址' })
  @IsString()
  @IsNotEmpty({ message: '主图不能为空' })
  @MaxLength(500)
  mainImage: string;

  @ApiPropertyOptional({ description: '商品详情（富文本/文本）' })
  @IsOptional()
  @IsString()
  detail?: string;

  @ApiPropertyOptional({ description: '状态：0 下架 / 1 上架', default: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiPropertyOptional({ description: '商品图集 URL 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: '规格组列表', type: [CreateSpecGroupDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSpecGroupDto)
  specGroups?: CreateSpecGroupDto[];
}

export class UpdateProductDto {
  @ApiPropertyOptional({ description: '商品名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '副标题' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subTitle?: string;

  @ApiPropertyOptional({ description: '分类 id' })
  @IsOptional()
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ description: '品牌 id' })
  @IsOptional()
  @IsInt()
  brandId?: number;

  @ApiPropertyOptional({ description: '主图地址' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mainImage?: string;

  @ApiPropertyOptional({ description: '商品详情' })
  @IsOptional()
  @IsString()
  detail?: string;

  @ApiPropertyOptional({ description: '状态：0 下架 / 1 上架' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiPropertyOptional({ description: '商品图集 URL 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

/** 更新单个 SKU（创建商品后，运营逐个填价格/库存）；金额单位：分 */
export class UpdateSkuDto {
  @ApiPropertyOptional({ description: '价格（分）' })
  @IsOptional()
  @IsInt({ message: '价格必须为整数（单位分）' })
  @Min(0, { message: '价格不能为负' })
  price?: number;

  @ApiPropertyOptional({ description: '原价（分）' })
  @IsOptional()
  @IsInt()
  @Min(0)
  originalPrice?: number;

  @ApiPropertyOptional({ description: '库存' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: 'SKU 编码（最多 64 字）' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  skuCode?: string;

  @ApiPropertyOptional({ description: 'SKU 图片地址' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}

/** 批量更新 SKU 的单项：SKU id + 要改的字段（字段语义同 UpdateSkuDto） */
export class UpdateSkuItemDto extends UpdateSkuDto {
  @ApiProperty({ description: 'SKU id' })
  @IsInt({ message: 'SKU id 必须为整数' })
  id: number;
}

/** 批量更新 SKU：一次性提交多个 SKU，后端用事务保证原子性 */
export class BatchUpdateSkuDto {
  @ApiProperty({ description: '要更新的 SKU 列表', type: [UpdateSkuItemDto] })
  @IsArray({ message: 'skus 必须是数组' })
  @ArrayNotEmpty({ message: 'skus 不能为空' })
  @ValidateNested({ each: true })
  @Type(() => UpdateSkuItemDto)
  skus: UpdateSkuItemDto[];
}
