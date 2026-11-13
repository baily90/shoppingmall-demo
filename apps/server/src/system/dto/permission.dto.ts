import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiPropertyOptional({ description: '父权限 id（顶级权限不传）' })
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiProperty({ description: '类型：1 目录 / 2 菜单 / 3 按钮', example: 2 })
  @IsInt()
  @IsIn([1, 2, 3], { message: '类型只能为 1目录/2菜单/3按钮' })
  type: number;

  @ApiProperty({ description: '名称（最多 20 字）', example: '用户管理' })
  @IsString()
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(20, { message: '名称最多 20 字' })
  name: string;

  @ApiProperty({ description: '权限码', example: 'user:list' })
  @IsString()
  @IsNotEmpty({ message: '权限码不能为空' })
  @Matches(/^[a-z][a-z0-9:_-]*$/, { message: '权限码格式不正确' })
  code: string;

  @ApiPropertyOptional({ description: '前端路由路径' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: '图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用', default: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

export class UpdatePermissionDto {
  @ApiPropertyOptional({ description: '父权限 id' })
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiPropertyOptional({ description: '类型：1 目录 / 2 菜单 / 3 按钮' })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3], { message: '类型只能为 1目录/2菜单/3按钮' })
  type?: number;

  @ApiPropertyOptional({ description: '名称' })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '名称最多 20 字' })
  name?: string;

  @ApiPropertyOptional({ description: '权限码' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9:_-]*$/, { message: '权限码格式不正确' })
  code?: string;

  @ApiPropertyOptional({ description: '前端路由路径' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: '图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}
