import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { CurrentAdmin, AdminContext } from '../common/decorators/current-user.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AdminAuthService } from './admin-auth.service';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.adminAuthService.refresh(dto.refreshToken);
  }

  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.adminAuthService.logout(dto.refreshToken);
  }

  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  profile(@CurrentAdmin() admin: AdminContext) {
    return this.adminAuthService.profile(admin.id);
  }
}
