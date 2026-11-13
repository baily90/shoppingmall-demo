import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ description: '用户名（最多 20 字）', example: 'operator' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @MaxLength(20, { message: '用户名最多 20 字' })
  username: string;

  @ApiProperty({ description: '密码（6-20 位）', example: 'operator123' })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(20, { message: '密码最多 20 位' })
  password: string;

  @ApiProperty({ description: '昵称（最多 20 字）', example: '运营' })
  @IsString()
  @IsNotEmpty({ message: '昵称不能为空' })
  @MaxLength(20, { message: '昵称最多 20 字' })
  nickname: string;

  @ApiPropertyOptional({ description: '头像地址' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用', default: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;

  @ApiPropertyOptional({ description: '角色 id 列表', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  roleIds?: number[];
}

export class UpdateAdminDto {
  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '昵称最多 20 字' })
  nickname?: string;

  @ApiPropertyOptional({ description: '头像地址' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;

  @ApiPropertyOptional({ description: '新密码（6-20 位，改密码后踢下线）' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(20, { message: '密码最多 20 位' })
  password?: string;
}

export class AssignRolesDto {
  @ApiProperty({ description: '角色 id 列表', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  roleIds: number[];
}
