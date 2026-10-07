import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserJwtAuthGuard } from '../common/guards/user-jwt-auth.guard';
import { CurrentUser, UserContext } from '../common/decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { UserLoginDto } from './dto/user-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UserAuthService } from './user-auth.service';

@Controller('auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.userAuthService.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: UserLoginDto) {
    return this.userAuthService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.userAuthService.refresh(dto.refreshToken);
  }

  @UseGuards(UserJwtAuthGuard)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.userAuthService.logout(dto.refreshToken);
  }

  @UseGuards(UserJwtAuthGuard)
  @Get('profile')
  profile(@CurrentUser() user: UserContext) {
    return this.userAuthService.profile(user.id);
  }
}
