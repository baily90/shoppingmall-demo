import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: '手机号（11 位，1 开头）', example: '13800000001' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '密码（6-20 位）', example: 'test1234' })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(20, { message: '密码最多 20 位' })
  password: string;

  @ApiPropertyOptional({ description: '昵称（最多 30 字）', example: '小明' })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: '昵称最多 30 字' })
  nickname?: string;
}
