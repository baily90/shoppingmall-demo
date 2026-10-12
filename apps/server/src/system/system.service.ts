import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permission/permission.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { AssignRolesDto, CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';
import { AssignPermissionsDto, CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/permission.dto';
import { PageQueryDto } from '../common/dto/query.dto';

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  // ==================== 用户 ====================

  async listAdmins(query: PageQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    const where: Prisma.AdminUserWhereInput = keyword
      ? {
          OR: [
            { username: { contains: keyword, mode: 'insensitive' } },
            { nickname: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : {};

    const [list, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        where,
        select: {
          id: true,
          username: true,
          nickname: true,
          avatar: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { select: { role: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.adminUser.count({ where }),
    ]);

    return {
      list: list.map((a) => ({ ...a, avatar: this.storage.toPublicUrl(a.avatar) })),
      total,
      page,
      pageSize,
    };
  }

  async createAdmin(dto: CreateAdminDto) {
    const exists = await this.prisma.adminUser.findUnique({ where: { username: dto.username } });
    if (exists) throw new BusinessException(ErrorCode.EXISTS, '用户名已存在');

    const password = await bcrypt.hash(dto.password, 10);
    return this.prisma.adminUser.create({
      data: {
        username: dto.username,
        password,
        nickname: dto.nickname,
        avatar: this.storage.urlToKey(dto.avatar) ?? null,
        status: dto.status ?? 1,
        roles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      select: { id: true, username: true, nickname: true, status: true },
    });
  }

  async updateAdmin(id: number, dto: UpdateAdminDto) {
    await this.ensureAdmin(id);
    const data: Prisma.AdminUserUpdateInput = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.avatar !== undefined) data.avatar = this.storage.urlToKey(dto.avatar) ?? null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password !== undefined) data.password = await bcrypt.hash(dto.password, 10);
    return this.prisma.adminUser.update({ where: { id }, data, select: { id: true } });
  }

  async deleteAdmin(id: number, currentId: number) {
    if (id === currentId) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '不能删除当前登录账号');
    }
    await this.ensureAdmin(id);
    await this.prisma.adminUser.delete({ where: { id } });
    return null;
  }

  async assignRoles(id: number, dto: AssignRolesDto) {
    await this.ensureAdmin(id);
    await this.prisma.$transaction([
      this.prisma.adminUserRole.deleteMany({ where: { adminUserId: id } }),
      this.prisma.adminUserRole.createMany({
        data: dto.roleIds.map((roleId) => ({ adminUserId: id, roleId })),
      }),
    ]);
    return null;
  }

  private async ensureAdmin(id: number) {
    const found = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!found) throw new BusinessException(ErrorCode.NOT_FOUND, '用户不存在');
    return found;
  }

  // ==================== 角色 ====================

  async listRoles(query: PageQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    const where: Prisma.RoleWhereInput = keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { code: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : {};

    const [list, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        include: { permissions: { select: { permissionId: true } } },
        orderBy: { sort: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.role.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  async createRole(dto: CreateRoleDto) {
    const exists = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (exists) throw new BusinessException(ErrorCode.EXISTS, '角色编码已存在');

    return this.prisma.role.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description ?? null,
        status: dto.status ?? 1,
        sort: dto.sort ?? 0,
        permissions: dto.permissionIds?.length
          ? { create: dto.permissionIds.map((permissionId) => ({ permissionId })) }
          : undefined,
      },
      select: { id: true, name: true, code: true },
    });
  }

  async updateRole(id: number, dto: UpdateRoleDto) {
    await this.ensureRole(id);
    if (dto.code !== undefined) {
      const dup = await this.prisma.role.findFirst({ where: { code: dto.code, NOT: { id } } });
      if (dup) throw new BusinessException(ErrorCode.EXISTS, '角色编码已存在');
    }
    const data: Prisma.RoleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.sort !== undefined) data.sort = dto.sort;
    return this.prisma.role.update({ where: { id }, data, select: { id: true } });
  }

  async deleteRole(id: number) {
    await this.ensureRole(id);
    const userCount = await this.prisma.adminUserRole.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '该角色下存在用户，无法删除');
    }
    await this.prisma.role.delete({ where: { id } });
    return null;
  }

  async assignPermissions(id: number, dto: AssignPermissionsDto) {
    await this.ensureRole(id);
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      }),
    ]);
    return null;
  }

  private async ensureRole(id: number) {
    const found = await this.prisma.role.findUnique({ where: { id } });
    if (!found) throw new BusinessException(ErrorCode.NOT_FOUND, '角色不存在');
    return found;
  }

  // ==================== 权限 ====================

  async listPermissions() {
    return this.permissionService.getAllTree();
  }

  async createPermission(dto: CreatePermissionDto) {
    const exists = await this.prisma.permission.findUnique({ where: { code: dto.code } });
    if (exists) throw new BusinessException(ErrorCode.EXISTS, '权限码已存在');

    if (dto.parentId != null) {
      const parent = await this.prisma.permission.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BusinessException(ErrorCode.NOT_FOUND, '父权限不存在');
    }
    return this.prisma.permission.create({
      data: {
        parentId: dto.parentId ?? null,
        type: dto.type,
        name: dto.name,
        code: dto.code,
        path: dto.path ?? null,
        icon: dto.icon ?? null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
      },
      select: { id: true, name: true, code: true },
    });
  }

  async updatePermission(id: number, dto: UpdatePermissionDto) {
    await this.ensurePermission(id);
    if (dto.code !== undefined) {
      const dup = await this.prisma.permission.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (dup) throw new BusinessException(ErrorCode.EXISTS, '权限码已存在');
    }
    const data: Prisma.PermissionUpdateInput = {};
    if (dto.parentId != null) {
      if (dto.parentId === id) {
        throw new BusinessException(ErrorCode.NOT_ALLOWED, '不能将父级设为自己');
      }
      const parent = await this.prisma.permission.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BusinessException(ErrorCode.NOT_FOUND, '父权限不存在');
      data.parent = { connect: { id: dto.parentId } };
    }
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.path !== undefined) data.path = dto.path;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;
    return this.prisma.permission.update({ where: { id }, data, select: { id: true } });
  }

  async deletePermission(id: number) {
    await this.ensurePermission(id);
    const childCount = await this.prisma.permission.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '存在子权限，请先删除子权限');
    }
    await this.prisma.permission.delete({ where: { id } });
    return null;
  }

  private async ensurePermission(id: number) {
    const found = await this.prisma.permission.findUnique({ where: { id } });
    if (!found) throw new BusinessException(ErrorCode.NOT_FOUND, '权限不存在');
    return found;
  }
}
