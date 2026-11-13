import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/dto/query.dto';
import { HOME_LINK_TYPE_VALUES, HOME_SLOT_TYPE_VALUES } from '../home.constant';

/** 管理端首页装修位列表查询：分页 + type + 状态 */
export class ListHomeSlotDto extends PageQueryDto {
  @ApiProperty({ description: '装修位类型' })
  @Type(() => Number)
  @IsInt({ message: '类型必须为整数' })
  @IsIn(HOME_SLOT_TYPE_VALUES, { message: '类型非法' })
  type: number;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态非法' })
  status?: number;
}

export class CreateHomeSlotDto {
  @ApiProperty({ description: '装修位类型' })
  @Type(() => Number)
  @IsInt({ message: '类型必须为整数' })
  @IsIn(HOME_SLOT_TYPE_VALUES, { message: '类型非法' })
  type: number;

  @ApiProperty({ description: '名称（最多 30 字）' })
  @IsString({ message: '名称必须为字符串' })
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(30, { message: '名称最多 30 字' })
  name: string;

  @ApiProperty({ description: '图片地址' })
  @IsString({ message: '图片必须为字符串' })
  @IsNotEmpty({ message: '图片不能为空' })
  image: string;

  @ApiPropertyOptional({ description: '跳转类型' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '跳转类型必须为整数' })
  @IsIn(HOME_LINK_TYPE_VALUES, { message: '跳转类型非法' })
  linkType?: number;

  @ApiPropertyOptional({ description: '跳转值（最多 500 字）' })
  @IsOptional()
  @IsString({ message: '跳转值必须为字符串' })
  @MaxLength(500, { message: '跳转值最多 500 字' })
  linkValue?: string;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '排序必须为整数' })
  sort?: number;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态非法' })
  status?: number;
}

export class UpdateHomeSlotDto {
  @ApiPropertyOptional({ description: '名称' })
  @IsOptional()
  @IsString({ message: '名称必须为字符串' })
  @MaxLength(30, { message: '名称最多 30 字' })
  name?: string;

  @ApiPropertyOptional({ description: '图片地址' })
  @IsOptional()
  @IsString({ message: '图片必须为字符串' })
  image?: string;

  @ApiPropertyOptional({ description: '跳转类型' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '跳转类型必须为整数' })
  @IsIn(HOME_LINK_TYPE_VALUES, { message: '跳转类型非法' })
  linkType?: number;

  @ApiPropertyOptional({ description: '跳转值' })
  @IsOptional()
  @IsString({ message: '跳转值必须为字符串' })
  @MaxLength(500, { message: '跳转值最多 500 字' })
  linkValue?: string;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '排序必须为整数' })
  sort?: number;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态非法' })
  status?: number;
}
