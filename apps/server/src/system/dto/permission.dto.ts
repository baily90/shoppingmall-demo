import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsInt()
  @IsIn([1, 2, 3], { message: '类型只能为 1目录/2菜单/3按钮' })
  type: number;

  @IsString()
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(20, { message: '名称最多 20 字' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: '权限码不能为空' })
  @Matches(/^[a-z][a-z0-9:_-]*$/, { message: '权限码格式不正确' })
  code: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

export class UpdatePermissionDto {
  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3], { message: '类型只能为 1目录/2菜单/3按钮' })
  type?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '名称最多 20 字' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9:_-]*$/, { message: '权限码格式不正确' })
  code?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}
