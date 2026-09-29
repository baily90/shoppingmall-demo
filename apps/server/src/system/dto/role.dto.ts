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
  @IsString()
  @IsNotEmpty({ message: '角色名不能为空' })
  @MaxLength(20, { message: '角色名最多 20 字' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: '角色编码不能为空' })
  @Matches(/^[a-z][a-z0-9_]*$/, { message: '编码需为小写字母开头的字母/数字/下划线' })
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '描述最多 100 字' })
  description?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  permissionIds?: number[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '角色名最多 20 字' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: '编码需为小写字母开头的字母/数字/下划线' })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '描述最多 100 字' })
  description?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;

  @IsOptional()
  @IsInt()
  sort?: number;
}

export class AssignPermissionsDto {
  @IsArray()
  @IsInt({ each: true })
  permissionIds: number[];
}
