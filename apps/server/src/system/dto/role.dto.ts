import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: '角色名（最多 20 字）', example: '运营' })
  @IsString()
  @IsNotEmpty({ message: '角色名不能为空' })
  @MaxLength(20, { message: '角色名最多 20 字' })
  name: string;

  @ApiProperty({ description: '角色编码（小写字母开头，字母/数字/下划线）', example: 'operator' })
  @IsString()
  @IsNotEmpty({ message: '角色编码不能为空' })
  @Matches(/^[a-z][a-z0-9_]*$/, { message: '编码需为小写字母开头的字母/数字/下划线' })
  code: string;

  @ApiPropertyOptional({ description: '描述（最多 100 字）' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '描述最多 100 字' })
  description?: string;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用', default: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiPropertyOptional({ description: '权限 id 列表', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  permissionIds?: number[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: '角色名' })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '角色名最多 20 字' })
  name?: string;

  @ApiPropertyOptional({ description: '角色编码' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: '编码需为小写字母开头的字母/数字/下划线' })
  code?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '描述最多 100 字' })
  description?: string;

  @ApiPropertyOptional({ description: '状态：0 禁用 / 1 启用' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;

  @ApiPropertyOptional({ description: '排序值' })
  @IsOptional()
  @IsInt()
  sort?: number;
}

export class AssignPermissionsDto {
  @ApiProperty({ description: '权限 id 列表', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  permissionIds: number[];
}
