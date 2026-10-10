import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { RedisService } from '../redis/redis.service';
import { productDetailKey } from '../common/cache.constant';
import { OrderStatus } from '../trade/order.constant';
import { ReviewStatus } from './review.constant';
import {
  AdminListReviewDto,
  CreateReviewDto,
  ListReviewQueryDto,
  SetReviewStatusDto,
} from './dto/review.dto';
import { PageQueryDto } from '../common/dto/query.dto';

/**
 * 商品评价：按订单项（orderItemId 唯一），仅已完成订单可评。
 * 先发后审——提交即展示（status=1），后台可屏蔽（0）/恢复（1）。
 * 评分聚合冗余在 Product（reviewCount/ratingSum），写评价时原子增减 + 失效商品详情缓存。
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /** 提交评价：仅「已完成」订单的订单项可评；同一订单项只能评一次 */
  async create(userId: number, dto: CreateReviewDto) {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { order: { select: { id: true, userId: true, status: true } } },
    });
    if (!orderItem || orderItem.orderId !== dto.orderId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '订单项不存在');
    }
    if (orderItem.order.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '订单不存在');
    }
    if (orderItem.order.status !== OrderStatus.COMPLETED) {
      throw new BusinessException(ErrorCode.ORDER_STATE_INVALID, '仅已完成订单可评价');
    }

    let review: { id: number };
    try {
      review = await this.prisma.productReview.create({
        data: {
          orderId: orderItem.orderId,
          orderItemId: orderItem.id,
          userId,
          productId: orderItem.productId,
          rating: dto.rating,
          content: dto.content?.trim() || null,
          images: dto.images?.length ? dto.images : undefined,
          anonymous: dto.anonymous ?? false,
          status: ReviewStatus.VISIBLE,
        },
      });
    } catch (e) {
      // orderItemId 唯一索引命中：该订单项已评价
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BusinessException(ErrorCode.REVIEW_EXISTS, '该商品已评价过');
      }
      throw e;
    }

    // 评分聚合 + 失效商品详情缓存（先发后审：提交即计入评分）
    await this.prisma.product.update({
      where: { id: orderItem.productId },
      data: { reviewCount: { increment: 1 }, ratingSum: { increment: dto.rating } },
    });
    await this.redisService.tryDel(productDetailKey(orderItem.productId));
    return { id: review.id };
  }

  /**
   * 商品评价公开列表：只出「正常展示」的评价，匿名者昵称/头像打码。
   * 传入 currentUserId 时标记 mine，供详情页置顶当前用户自己的评价。
   */
  async listByProduct(productId: number, query: ListReviewQueryDto, currentUserId?: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.ProductReviewWhereInput = {
      productId,
      status: ReviewStatus.VISIBLE,
    };
    const [list, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        include: {
          user: { select: { nickname: true, avatar: true } },
          orderItem: { select: { skuSpec: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return {
      list: list.map((r) => ({
        id: r.id,
        rating: r.rating,
        content: r.content,
        images: (r.images as string[] | null) ?? [],
        anonymous: r.anonymous,
        nickname: r.anonymous ? this.maskNickname(r.user.nickname) : r.user.nickname,
        avatar: r.anonymous ? null : r.user.avatar,
        skuSpec: r.orderItem.skuSpec,
        mine: currentUserId != null && r.userId === currentUserId,
        createdAt: r.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 我的评价：当前用户评价过的所有商品（含已屏蔽，让用户能看到自己评价的状态） */
  async listMine(userId: number, query: PageQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.ProductReviewWhereInput = { userId };
    const [list, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, mainImage: true } },
          orderItem: { select: { skuSpec: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return {
      list: list.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        productId: r.productId,
        rating: r.rating,
        content: r.content,
        images: (r.images as string[] | null) ?? [],
        anonymous: r.anonymous,
        status: r.status,
        product: r.product,
        skuSpec: r.orderItem.skuSpec,
        createdAt: r.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  // ---------- 管理端 ----------

  async adminList(query: AdminListReviewDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    const where: Prisma.ProductReviewWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.rating !== undefined ? { rating: query.rating } : {}),
      ...(query.productId !== undefined ? { productId: query.productId } : {}),
      ...(keyword ? { content: { contains: keyword } } : {}),
    };
    const [list, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, mainImage: true } },
          user: { select: { id: true, nickname: true, phone: true } },
          order: { select: { id: true, orderNo: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.productReview.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  /** 屏蔽/恢复评价：原子切换状态 + 同步商品评分聚合（乐观锁） */
  async adminSetStatus(id: number, dto: SetReviewStatusDto) {
    if (dto.status !== ReviewStatus.VISIBLE && dto.status !== ReviewStatus.BLOCKED) {
      throw new BusinessException(ErrorCode.PARAM_INVALID, '状态非法');
    }
    const review = await this.prisma.productReview.findUnique({ where: { id } });
    if (!review) throw new BusinessException(ErrorCode.NOT_FOUND, '评价不存在');
    if (review.status === dto.status) {
      throw new BusinessException(ErrorCode.REVIEW_STATE_INVALID, '评价状态未变化');
    }

    // 屏蔽（1→0）减一、恢复（0→1）加一
    const inc = dto.status === ReviewStatus.BLOCKED ? -1 : 1;
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.productReview.updateMany({
        where: { id, status: review.status },
        data: { status: dto.status },
      });
      if (res.count === 0) {
        throw new BusinessException(ErrorCode.REVIEW_STATE_INVALID, '评价状态已变化，请刷新');
      }
      await tx.product.update({
        where: { id: review.productId },
        data: {
          reviewCount: { increment: inc },
          ratingSum: { increment: inc * review.rating },
        },
      });
    });

    await this.redisService.tryDel(productDetailKey(review.productId));
    return null;
  }

  // ---------- 工具 ----------

  /** 匿名昵称打码：仅保留首字 */
  private maskNickname(nickname: string): string {
    return nickname ? `${nickname.slice(0, 1)}***` : '***';
  }
}
