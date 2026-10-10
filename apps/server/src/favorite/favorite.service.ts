import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PageQueryDto } from '../common/dto/query.dto';

/**
 * 商品收藏（按 SPU）：userId+productId 唯一，幂等增删。
 * 收藏夹列表返回商品卡片信息（含最低在售 SKU 价），已下架/软删商品仍展示、由前端标「已失效」。
 */
@Injectable()
export class FavoriteService {
  constructor(private readonly prisma: PrismaService) {}

  /** 收藏（幂等 upsert） */
  async add(userId: number, productId: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '商品不存在');
    }
    await this.prisma.productFavorite.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return { favorited: true };
  }

  /** 取消收藏（幂等） */
  async remove(userId: number, productId: number) {
    await this.prisma.productFavorite.deleteMany({ where: { userId, productId } });
    return { favorited: false };
  }

  /** 我的收藏（分页，含商品卡片信息） */
  async list(userId: number, query: PageQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.ProductFavoriteWhereInput = { userId };
    const [list, total] = await Promise.all([
      this.prisma.productFavorite.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              mainImage: true,
              status: true,
              deletedAt: true,
              // 最低在售 SKU 价（镜像商品列表卡片逻辑）
              skus: {
                where: { status: 1 },
                orderBy: { price: 'asc' },
                take: 1,
                select: { price: true },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.productFavorite.count({ where }),
    ]);

    return {
      list: list.map((f) => ({
        id: f.id,
        productId: f.productId,
        price: f.product.skus[0]?.price ?? null,
        product: {
          id: f.product.id,
          name: f.product.name,
          mainImage: f.product.mainImage,
          status: f.product.status,
          deleted: !!f.product.deletedAt,
        },
        createdAt: f.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 是否已收藏（详情页红心状态） */
  async status(userId: number, productId: number) {
    const count = await this.prisma.productFavorite.count({ where: { userId, productId } });
    return { favorited: count > 0 };
  }
}
