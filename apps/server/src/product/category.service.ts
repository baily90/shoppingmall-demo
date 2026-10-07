import { Injectable } from '@nestjs/common';
import type { Category, Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { RedisService } from '../redis/redis.service';
import {
  CACHE_TTL_SECONDS,
  categoryTreeAllKey,
  categoryTreeEnabledKey,
} from '../common/cache.constant';

export interface CategoryNode {
  id: number;
  parentId: number | null;
  name: string;
  level: number;
  sort: number;
  status: number;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
  children: CategoryNode[];
}

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /** 分类树（未删除的；onlyEnabled 时只返回启用分类），带缓存 */
  async getTree(onlyEnabled = false): Promise<CategoryNode[]> {
    const cacheKey = onlyEnabled ? categoryTreeEnabledKey : categoryTreeAllKey;
    const cached = await this.redisService.getJSON<CategoryNode[]>(cacheKey);
    if (cached) return cached;

    const list = await this.prisma.category.findMany({
      where: { deletedAt: null, ...(onlyEnabled ? { status: 1 } : {}) },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    const tree = this.buildTree(list);
    await this.redisService.setJSON(cacheKey, tree, CACHE_TTL_SECONDS);
    return tree;
  }

  /** 收集某分类及其全部后代的 id（用于「按父分类查所有子分类商品」） */
  async getDescendantIds(id: number): Promise<number[]> {
    const all = await this.prisma.category.findMany({
      where: { deletedAt: null },
      select: { id: true, parentId: true },
    });
    const childrenMap = new Map<number, number[]>();
    for (const c of all) {
      if (c.parentId != null) {
        const arr = childrenMap.get(c.parentId) ?? [];
        arr.push(c.id);
        childrenMap.set(c.parentId, arr);
      }
    }
    const ids: number[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      ids.push(cur);
      for (const child of childrenMap.get(cur) ?? []) stack.push(child);
    }
    return ids;
  }

  async create(dto: CreateCategoryDto) {
    let level = 1;
    if (dto.parentId != null) {
      const parent = await this.ensureCategory(dto.parentId);
      level = parent.level + 1;
      if (level > 2) {
        throw new BusinessException(ErrorCode.NOT_ALLOWED, '分类最多支持两级');
      }
    }

    const result = await this.prisma.category.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        level,
        icon: dto.icon ?? null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
      },
      select: { id: true, name: true, parentId: true, level: true },
    });
    await this.invalidateCategoryCache();
    return result;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.ensureCategory(id);
    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;
    const result = await this.prisma.category.update({ where: { id }, data, select: { id: true } });
    await this.invalidateCategoryCache();
    return result;
  }

  async remove(id: number) {
    await this.ensureCategory(id);
    const childCount = await this.prisma.category.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '存在子分类，请先删除子分类');
    }
    const productCount = await this.prisma.product.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (productCount > 0) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '该分类下存在商品，无法删除');
    }
    // 软删除：保留数据，避免破坏商品/订单的历史关联
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.invalidateCategoryCache();
    return null;
  }

  /** 分类增删改后，同时失效两份分类树缓存（管理端全量 + 商城端启用） */
  private async invalidateCategoryCache() {
    await this.redisService.tryDel(categoryTreeAllKey);
    await this.redisService.tryDel(categoryTreeEnabledKey);
  }

  private async ensureCategory(id: number): Promise<Category> {
    const found = await this.prisma.category.findUnique({ where: { id } });
    if (!found || found.deletedAt) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '分类不存在');
    }
    return found;
  }

  private buildTree(list: Category[]): CategoryNode[] {
    const nodes: CategoryNode[] = list.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      name: c.name,
      level: c.level,
      sort: c.sort,
      status: c.status,
      icon: c.icon,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      children: [],
    }));
    const map = new Map<number, CategoryNode>();
    for (const n of nodes) map.set(n.id, n);

    const roots: CategoryNode[] = [];
    for (const n of nodes) {
      if (n.parentId != null && map.has(n.parentId)) {
        map.get(n.parentId)!.children.push(n);
      } else {
        roots.push(n);
      }
    }
    const sortRec = (arr: CategoryNode[]) => {
      arr.sort((a, b) => a.sort - b.sort || a.id - b.id);
      arr.forEach((x) => sortRec(x.children));
    };
    sortRec(roots);
    return roots;
  }
}
