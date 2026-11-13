import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UserLoginDto {
  @ApiProperty({ description: '手机号', example: '13800000001' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  phone: string;

  @ApiProperty({ description: '密码', example: 'test1234' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}
