import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { CurrentAdmin, AdminContext } from '../common/decorators/current-user.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AdminAuthService } from './admin-auth.service';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.adminAuthService.refresh(dto.refreshToken);
  }

  @UseGuards(AdminJwtAuthGuard)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.adminAuthService.logout(dto.refreshToken);
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('profile')
  profile(@CurrentAdmin() admin: AdminContext) {
    return this.adminAuthService.profile(admin.id);
  }
}
