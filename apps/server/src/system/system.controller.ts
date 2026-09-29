import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-user.decorator';
import type { AdminContext } from '../common/decorators/current-user.decorator';
import { SystemService } from './system.service';
import { AssignRolesDto, CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';
import { AssignPermissionsDto, CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/permission.dto';
import { PageQueryDto } from './dto/query.dto';

@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  // ==================== 用户 ====================

  @Get('users')
  @Permissions('user:list')
  listAdmins(@Query() query: PageQueryDto) {
    return this.systemService.listAdmins(query);
  }

  @Post('users')
  @Permissions('user:create')
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.systemService.createAdmin(dto);
  }

  @Patch('users/:id')
  @Permissions('user:update')
  updateAdmin(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdminDto) {
    return this.systemService.updateAdmin(id, dto);
  }

  @Delete('users/:id')
  @Permissions('user:delete')
  deleteAdmin(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: AdminContext) {
    return this.systemService.deleteAdmin(id, admin.id);
  }

  @Put('users/:id/roles')
  @Permissions('user:assign-role')
  assignRoles(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignRolesDto) {
    return this.systemService.assignRoles(id, dto);
  }

  // ==================== 角色 ====================

  @Get('roles')
  @Permissions('role:list')
  listRoles(@Query() query: PageQueryDto) {
    return this.systemService.listRoles(query);
  }

  @Post('roles')
  @Permissions('role:create')
  createRole(@Body() dto: CreateRoleDto) {
    return this.systemService.createRole(dto);
  }

  @Patch('roles/:id')
  @Permissions('role:update')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.systemService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @Permissions('role:delete')
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.systemService.deleteRole(id);
  }

  @Put('roles/:id/permissions')
  @Permissions('role:assign-permission')
  assignPermissions(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignPermissionsDto) {
    return this.systemService.assignPermissions(id, dto);
  }

  // ==================== 权限 ====================

  @Get('permissions')
  @Permissions('permission:list')
  listPermissions() {
    return this.systemService.listPermissions();
  }

  @Post('permissions')
  @Permissions('permission:create')
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.systemService.createPermission(dto);
  }

  @Patch('permissions/:id')
  @Permissions('permission:update')
  updatePermission(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePermissionDto) {
    return this.systemService.updatePermission(id, dto);
  }

  @Delete('permissions/:id')
  @Permissions('permission:delete')
  deletePermission(@Param('id', ParseIntPipe) id: number) {
    return this.systemService.deletePermission(id);
  }
}
