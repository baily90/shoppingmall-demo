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
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '分类 id 必须为整数' })
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '品牌 id 必须为整数' })
  brandId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

/** 规格组：一个组名 + 一组规格值 */
export class CreateSpecGroupDto {
  @IsString()
  @IsNotEmpty({ message: '规格组名称不能为空' })
  @MaxLength(30, { message: '规格组名称最多 30 字' })
  name: string;

  @IsArray({ message: '规格值必须是数组' })
  @ArrayNotEmpty({ message: '规格值不能为空' })
  @IsString({ each: true, message: '规格值必须为字符串' })
  values: string[];
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: '商品名称不能为空' })
  @MaxLength(100, { message: '商品名称最多 100 字' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subTitle?: string;

  @IsInt({ message: '分类 id 必须为整数' })
  categoryId: number;

  @IsInt({ message: '品牌 id 必须为整数' })
  brandId: number;

  @IsString()
  @IsNotEmpty({ message: '主图不能为空' })
  @MaxLength(500)
  mainImage: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSpecGroupDto)
  specGroups?: CreateSpecGroupDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subTitle?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  brandId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mainImage?: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

/** 更新单个 SKU（创建商品后，运营逐个填价格/库存）；金额单位：分 */
export class UpdateSkuDto {
  @IsOptional()
  @IsInt({ message: '价格必须为整数（单位分）' })
  @Min(0, { message: '价格不能为负' })
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  skuCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}
