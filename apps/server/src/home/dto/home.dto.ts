import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';
import { HOME_LINK_TYPE_VALUES, HOME_SLOT_TYPE_VALUES } from '../home.constant';

/** 管理端首页装修位列表查询：分页 + type + 状态 */
export class ListHomeSlotDto extends PageQueryDto {
  @Type(() => Number)
  @IsInt({ message: '类型必须为整数' })
  @IsIn(HOME_SLOT_TYPE_VALUES, { message: '类型非法' })
  type: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态非法' })
  status?: number;
}

export class CreateHomeSlotDto {
  @Type(() => Number)
  @IsInt({ message: '类型必须为整数' })
  @IsIn(HOME_SLOT_TYPE_VALUES, { message: '类型非法' })
  type: number;

  @IsString({ message: '名称必须为字符串' })
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(30, { message: '名称最多 30 字' })
  name: string;

  @IsString({ message: '图片必须为字符串' })
  @IsNotEmpty({ message: '图片不能为空' })
  image: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '跳转类型必须为整数' })
  @IsIn(HOME_LINK_TYPE_VALUES, { message: '跳转类型非法' })
  linkType?: number;

  @IsOptional()
  @IsString({ message: '跳转值必须为字符串' })
  @MaxLength(500, { message: '跳转值最多 500 字' })
  linkValue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '排序必须为整数' })
  sort?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态非法' })
  status?: number;
}

export class UpdateHomeSlotDto {
  @IsOptional()
  @IsString({ message: '名称必须为字符串' })
  @MaxLength(30, { message: '名称最多 30 字' })
  name?: string;

  @IsOptional()
  @IsString({ message: '图片必须为字符串' })
  image?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '跳转类型必须为整数' })
  @IsIn(HOME_LINK_TYPE_VALUES, { message: '跳转类型非法' })
  linkType?: number;

  @IsOptional()
  @IsString({ message: '跳转值必须为字符串' })
  @MaxLength(500, { message: '跳转值最多 500 字' })
  linkValue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '排序必须为整数' })
  sort?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态非法' })
  status?: number;
}
