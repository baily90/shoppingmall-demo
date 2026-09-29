import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty({ message: '品牌名称不能为空' })
  @MaxLength(30, { message: '品牌名称最多 30 字' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'logo 地址最多 200 字' })
  logo?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  logo?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}
