import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 分页 + 关键字查询参数（通用列表接口） */
export class PageQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  @Min(1, { message: 'page 最小为 1' })
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  @IsOptional()
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: '关键字最多 50 字' })
  keyword?: string;
}
