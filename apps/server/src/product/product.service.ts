import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import {
  BatchUpdateSkuDto,
  CreateProductDto,
  ListProductDto,
  UpdateProductDto,
  UpdateSkuDto,
} from './dto/product.dto';
import { CategoryService } from './category.service';
import { RedisService } from '../redis/redis.service';
import { CACHE_TTL_SECONDS, productDetailKey } from '../common/cache.constant';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: CategoryService,
    private readonly redisService: RedisService,
  ) {}

  async list(query: ListProductDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(keyword ? { name: { contains: keyword, mode: 'insensitive' } } : {}),
      ...(query.brandId !== undefined ? { brandId: query.brandId } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    };
    // 按父分类筛选时，同时命中其全部后代分类下的商品（与商城端 listOnSale 一致）
    if (query.categoryId !== undefined) {
      const categoryIds = await this.categoryService.getDescendantIds(query.categoryId);
      where.categoryId = { in: categoryIds };
    }

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          _count: { select: { skus: true } },
        },
        orderBy: [{ sort: 'asc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /** 商城端商品列表：只出上架商品，附最低价（最便宜的在售 SKU 价，单位分） */
  async listOnSale(query: ListProductDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    // 按父分类查时，同时命中其全部后代分类下的商品
    const categoryIds =
      query.categoryId !== undefined
        ? await this.categoryService.getDescendantIds(query.categoryId)
        : undefined;
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: 1,
      ...(keyword ? { name: { contains: keyword, mode: 'insensitive' } } : {}),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(query.brandId !== undefined ? { brandId: query.brandId } : {}),
    };

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          subTitle: true,
          mainImage: true,
          skus: {
            where: { status: 1 },
            orderBy: { price: 'asc' },
            take: 1,
            select: { price: true, originalPrice: true },
          },
        },
        orderBy: [{ sort: 'asc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      list: list.map((p) => ({
        id: p.id,
        name: p.name,
        subTitle: p.subTitle,
        mainImage: p.mainImage,
        price: p.skus[0]?.price ?? null,
        originalPrice: p.skus[0]?.originalPrice ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async detail(id: number, onlyOnSale = false) {
    await this.ensureProduct(id);
    const detail = await this.getDetail(id);
    if (onlyOnSale && detail.status !== 1) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '商品不存在或已下架');
    }
    return detail;
  }

  async create(dto: CreateProductDto) {
    await this.ensureCategory(dto.categoryId);
    await this.ensureLeafCategory(dto.categoryId);
    await this.ensureBrand(dto.brandId);

    const productId = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          subTitle: dto.subTitle ?? null,
          categoryId: dto.categoryId,
          brandId: dto.brandId,
          mainImage: dto.mainImage,
          detail: dto.detail ?? null,
          status: dto.status ?? 1,
          sort: dto.sort ?? 0,
          images: dto.images?.length
            ? { create: dto.images.map((url, i) => ({ url, sort: i })) }
            : undefined,
        },
      });

      // 1) 落规格组 + 规格值，收集每组的值对象数组
      const groupValues: { id: number }[][] = [];
      for (const [gi, g] of (dto.specGroups ?? []).entries()) {
        const group = await tx.productSpecGroup.create({
          data: { productId: product.id, name: g.name, sort: gi },
        });
        const values: { id: number }[] = [];
        for (const [vi, v] of g.values.entries()) {
          values.push(
            await tx.productSpecValue.create({
              data: { groupId: group.id, value: v, sort: vi },
            }),
          );
        }
        groupValues.push(values);
      }

      // 2) 笛卡尔积生成 SKU 组合：颜色[红,蓝] × 容量[128G,256G] → 4 个 SKU
      //    无规格时 cartesian 返回 [[]]，即生成一个不带规格的默认 SKU
      const combos = this.cartesian(groupValues);
      for (const combo of combos) {
        await tx.productSku.create({
          data: {
            productId: product.id,
            price: 0,
            stock: 0,
            specValues: combo.length
              ? { create: combo.map((sv) => ({ specValueId: sv.id })) }
              : undefined,
          },
        });
      }

      return product.id;
    });

    return this.getDetail(productId);
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.ensureProduct(id);
    if (dto.categoryId !== undefined) {
      await this.ensureCategory(dto.categoryId);
      await this.ensureLeafCategory(dto.categoryId);
    }
    if (dto.brandId !== undefined) await this.ensureBrand(dto.brandId);

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.subTitle !== undefined) data.subTitle = dto.subTitle;
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
    if (dto.brandId !== undefined) data.brand = { connect: { id: dto.brandId } };
    if (dto.mainImage !== undefined) data.mainImage = dto.mainImage;
    if (dto.detail !== undefined) data.detail = dto.detail;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.sort !== undefined) data.sort = dto.sort;
    // 轮播图：先删后建（数量少，简单可靠）
    if (dto.images !== undefined) {
      data.images = {
        deleteMany: {},
        create: dto.images.map((url, i) => ({ url, sort: i })),
      };
    }

    await this.prisma.product.update({ where: { id }, data });
    // 失效该商品详情缓存，管理端改动秒级对 C 端生效（漏删由 TTL 兜底）
    await this.redisService.tryDel(productDetailKey(id));
    return { id };
  }

  async remove(id: number) {
    await this.ensureProduct(id);
    // 软删除：保留订单/购物车的历史关联
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.redisService.tryDel(productDetailKey(id));
    return null;
  }

  async updateSku(skuId: number, dto: UpdateSkuDto) {
    const sku = await this.ensureSku(skuId);
    const data: Prisma.ProductSkuUpdateInput = {};
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.originalPrice !== undefined) data.originalPrice = dto.originalPrice;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.skuCode !== undefined) data.skuCode = dto.skuCode;
    if (dto.image !== undefined) data.image = dto.image;
    if (dto.status !== undefined) data.status = dto.status;
    const result = await this.prisma.productSku.update({
      where: { id: skuId },
      data,
      select: { id: true, price: true, stock: true },
    });
    // SKU 价格/库存/上下架都会体现在商品详情里，失效所属商品缓存
    await this.redisService.tryDel(productDetailKey(sku.productId));
    return result;
  }

  /** 批量更新 SKU：一次事务提交，要么全成功要么全回滚，避免「改一半」 */
  async batchUpdateSkus(dto: BatchUpdateSkuDto) {
    // 先校验所有 SKU 都存在，避免事务跑到一半才报「不存在」；顺便拿到所属商品 id 用于失效缓存
    const ids = [...new Set(dto.skus.map((s) => s.id))];
    const skus = await this.prisma.productSku.findMany({
      where: { id: { in: ids } },
      select: { id: true, productId: true },
    });
    if (skus.length !== ids.length) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '存在无效的 SKU');
    }
    const productIds = [...new Set(skus.map((s) => s.productId))];

    await this.prisma.$transaction(
      dto.skus.map((s) => {
        const data: Prisma.ProductSkuUpdateInput = {};
        if (s.price !== undefined) data.price = s.price;
        if (s.originalPrice !== undefined) data.originalPrice = s.originalPrice;
        if (s.stock !== undefined) data.stock = s.stock;
        if (s.skuCode !== undefined) data.skuCode = s.skuCode;
        if (s.image !== undefined) data.image = s.image;
        if (s.status !== undefined) data.status = s.status;
        return this.prisma.productSku.update({ where: { id: s.id }, data });
      }),
    );

    // 涉及的 SKU 分属不同商品，逐一失效对应商品详情缓存
    await Promise.all(productIds.map((pid) => this.redisService.tryDel(productDetailKey(pid))));
    return null;
  }

  /** 商品完整详情：分类/品牌 + 轮播图 + 规格组→值 + SKU（含规格组合），带缓存 */
  private async getDetail(productId: number) {
    const cacheKey = productDetailKey(productId);
    const cached = await this.redisService.getJSON(cacheKey);
    if (cached) return cached;

    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        images: { orderBy: { sort: 'asc' } },
        specGroups: {
          orderBy: { sort: 'asc' },
          include: { values: { orderBy: { sort: 'asc' } } },
        },
        skus: {
          orderBy: { id: 'asc' },
          include: {
            specValues: {
              include: {
                specValue: { include: { group: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    });

    const detail = {
      ...product,
      skus: product.skus.map((sku) => ({
        id: sku.id,
        price: sku.price,
        originalPrice: sku.originalPrice,
        stock: sku.stock,
        skuCode: sku.skuCode,
        image: sku.image,
        status: sku.status,
        // 规格组合扁平化：颜色=红、容量=128G
        specValues: sku.specValues.map((sv) => ({
          id: sv.specValue.id,
          value: sv.specValue.value,
          groupId: sv.specValue.group.id,
          groupName: sv.specValue.group.name,
        })),
      })),
    };

    await this.redisService.setJSON(cacheKey, detail, CACHE_TTL_SECONDS);
    return detail;
  }

  /** 笛卡尔积：[[a,b],[1,2]] → [[a,1],[a,2],[b,1],[b,2]]；空数组 → [[]] */
  private cartesian<T>(arrays: T[][]): T[][] {
    return arrays.reduce<T[][]>((acc, cur) => acc.flatMap((a) => cur.map((c) => [...a, c])), [[]]);
  }

  private async ensureProduct(id: number) {
    const found = await this.prisma.product.findUnique({ where: { id } });
    if (!found || found.deletedAt) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '商品不存在');
    }
    return found;
  }

  private async ensureCategory(id: number) {
    const found = await this.prisma.category.findUnique({ where: { id } });
    if (!found || found.deletedAt) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '分类不存在');
    }
    return found;
  }

  /** 商品只能挂到叶子分类（无子分类），避免父分类既有子分类又直接挂商品 */
  private async ensureLeafCategory(id: number) {
    const childCount = await this.prisma.category.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '请选择叶子分类（该分类下还有子分类）');
    }
  }

  private async ensureBrand(id: number) {
    const found = await this.prisma.brand.findUnique({ where: { id } });
    if (!found || found.deletedAt) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '品牌不存在');
    }
    return found;
  }

  private async ensureSku(id: number) {
    const found = await this.prisma.productSku.findUnique({ where: { id } });
    if (!found) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'SKU 不存在');
    }
    return found;
  }
}
