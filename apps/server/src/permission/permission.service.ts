import { Injectable } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface MenuNode {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  type: number;
  path: string | null;
  icon: string | null;
  sort: number;
  status: number;
  children: MenuNode[];
}

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /** 某管理员的全部权限码（穿透角色 → 权限） */
  async getAdminPermissionCodes(adminId: number): Promise<string[]> {
    const userRoles = await this.prisma.adminUserRole.findMany({
      where: { adminUserId: adminId },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });
    const codes = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        codes.add(rp.permission.code);
      }
    }
    return [...codes];
  }

  /** 某管理员的菜单树（仅目录 + 菜单，用于前端动态菜单） */
  async getAdminMenus(adminId: number): Promise<MenuNode[]> {
    const codes = await this.getAdminPermissionCodes(adminId);
    if (codes.length === 0) return [];
    const perms = await this.prisma.permission.findMany({
      where: { code: { in: codes }, type: { in: [1, 2] }, status: 1 },
      orderBy: { sort: 'asc' },
    });
    return this.buildTree(perms);
  }

  /** 全量权限树（含按钮与禁用项，用于权限管理页） */
  async getAllTree(): Promise<MenuNode[]> {
    const perms = await this.prisma.permission.findMany({
      orderBy: { sort: 'asc' },
    });
    return this.buildTree(perms);
  }

  private buildTree(perms: Permission[]): MenuNode[] {
    const nodeMap = new Map<number, MenuNode>();
    for (const p of perms) {
      nodeMap.set(p.id, {
        id: p.id,
        parentId: p.parentId,
        code: p.code,
        name: p.name,
        type: p.type,
        path: p.path,
        icon: p.icon,
        sort: p.sort,
        status: p.status,
        children: [],
      });
    }
    const roots: MenuNode[] = [];
    for (const p of perms) {
      const node = nodeMap.get(p.id)!;
      if (p.parentId && nodeMap.has(p.parentId)) {
        nodeMap.get(p.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    const sortRec = (nodes: MenuNode[]) => {
      nodes.sort((a, b) => a.sort - b.sort);
      nodes.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }
}
