import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.service';
import { BusinessException } from '../common/exceptions/business.exception';
import {
  SECKILL_CREATE_ORDER_JOB,
  SECKILL_GRAB_LUA,
  SECKILL_INIT_STOCK_LUA,
  SECKILL_QUEUE,
  SECKILL_RESULT_TTL_SECONDS,
  seckillKeyTtlSeconds,
  seckillReqKey,
  seckillResultKey,
  seckillStockKey,
  seckillUsersKey,
} from './seckill.constant';
import {
  CreateSeckillActivityDto,
  ListSeckillActivityDto,
  SeckillSkuDto,
  UpdateSeckillActivityDto,
  UpdateSeckillSkuDto,
} from './dto/seckill.dto';

/** 落单任务载荷：抢到资格后投递到 MQ，由 SeckillProcessor 异步建单 */
export interface SeckillJobData {
  requestId: string;
  userId: number;
  activityId: number;
  skuId: number;
  price: number; // 秒杀价（分）
  quantity: number; // 秒杀限购 1 件
}

/** 秒杀商品卡（C 端列表项） */
export interface SeckillProductView {
  skuId: number;
  productId: number;
  productName: string;
  productImage: string;
  skuSpec: string;
  seckillPrice: number;
  originalPrice: number;
  remainingStock: number;
  status: 'ongoing' | 'sold_out';
}

/** 秒杀活动（C 端列表项，含商品卡） */
export interface SeckillActivityView {
  activityId: number;
  name: string;
  startTime: Date;
  endTime: Date;
  status: 'upcoming' | 'ongoing';
  products: SeckillProductView[];
}

@Injectable()
export class SeckillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @InjectQueue(SECKILL_QUEUE) private readonly seckillQueue: Queue<SeckillJobData>,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  // ---------- C 端 ----------

  /** 秒杀专区（公开）：启用且未结束的活动，含每个活动的秒杀商品卡 */
  async listActivities(): Promise<SeckillActivityView[]> {
    const now = new Date();
    const activities = await this.prisma.seckillActivity.findMany({
      where: { status: 1, endTime: { gt: now } },
      include: {
        skus: {
          include: {
            sku: {
              include: {
                product: {
                  select: { id: true, name: true, mainImage: true, status: true, deletedAt: true },
                },
                specValues: {
                  include: { specValue: { include: { group: { select: { name: true } } } } },
                },
              },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const result: SeckillActivityView[] = [];
    for (const act of activities) {
      const products: SeckillProductView[] = [];
      for (const item of act.skus) {
        const sku = item.sku;
        if (sku.status !== 1 || sku.product.status !== 1 || sku.product.deletedAt) continue;
        await this.ensureSkuStock(act.id, item.skuId, item.seckillStock, sku.stock, act.endTime);
        const remaining = Number(
          (await this.redisService.get(seckillStockKey(act.id, item.skuId))) ?? 0,
        );
        products.push({
          skuId: sku.id,
          productId: sku.product.id,
          productName: sku.product.name,
          productImage: this.storage.toPublicUrl(sku.image ?? sku.product.mainImage)!,
          skuSpec: this.specText(sku.specValues),
          seckillPrice: item.seckillPrice,
          originalPrice: sku.price,
          remainingStock: remaining,
          status: remaining > 0 ? 'ongoing' : 'sold_out',
        });
      }
      result.push({
        activityId: act.id,
        name: act.name,
        startTime: act.startTime,
        endTime: act.endTime,
        status: now < act.startTime ? 'upcoming' : 'ongoing',
        products,
      });
    }
    return result;
  }

  /**
   * 抢购：校验活动时间窗口 → Redis 原子预扣资格 → 投递 MQ 异步落单 → 返回 requestId。
   * 抢到≠下单成功，最终结果靠 queryResult 轮询。
   */
  async grab(userId: number, activityId: number, skuId: number) {
    const activity = await this.prisma.seckillActivity.findUnique({ where: { id: activityId } });
    if (!activity) return { status: 'unavailable', message: '活动不存在' };
    if (activity.status !== 1) return { status: 'unavailable', message: '活动已停用' };
    const now = new Date();
    if (now < activity.startTime) return { status: 'unavailable', message: '活动未开始' };
    if (now >= activity.endTime) return { status: 'unavailable', message: '活动已结束' };

    const item = await this.prisma.seckillActivitySku.findUnique({
      where: { activityId_skuId: { activityId, skuId } },
      include: { sku: { include: { product: { select: { status: true, deletedAt: true } } } } },
    });
    if (!item) return { status: 'unavailable', message: '商品不在该活动中' };
    const { sku } = item;
    if (sku.status !== 1 || sku.product.status !== 1 || sku.product.deletedAt) {
      return { status: 'unavailable', message: '商品已下架' };
    }

    await this.ensureSkuStock(activityId, skuId, item.seckillStock, sku.stock, activity.endTime);

    const stockKey = seckillStockKey(activityId, skuId);
    const usersKey = seckillUsersKey(activityId, skuId);
    const ttl = seckillKeyTtlSeconds(activity.endTime);
    const outcome = (await this.redisService.evalScript(
      SECKILL_GRAB_LUA,
      [stockKey, usersKey],
      [String(userId), ttl],
    )) as number;

    if (outcome === -1) {
      // 已抢过：订单已生成则直接把订单号带回（前端直达订单详情），仍在处理中才带 requestId 继续轮询
      const requestId = await this.redisService.get(seckillReqKey(activityId, skuId, userId));
      if (!requestId) return { status: 'grabbed' };
      const result = await this.redisService.getJSON<{ status: string; orderId?: number }>(
        seckillResultKey(requestId),
      );
      if (result?.status === 'success' && result.orderId) {
        return { status: 'grabbed', orderId: result.orderId };
      }
      return { status: 'grabbed', requestId };
    }
    if (outcome === 0) {
      return { status: 'sold_out' };
    }

    // outcome === 1：抢到资格，写请求映射 + 结果占位 + 入队；任一步失败回补资格，避免「扣了没落单」
    const requestId = randomUUID();
    const jobData: SeckillJobData = {
      requestId,
      userId,
      activityId,
      skuId,
      price: item.seckillPrice,
      quantity: 1,
    };
    try {
      await this.redisService.set(
        seckillReqKey(activityId, skuId, userId),
        requestId,
        SECKILL_RESULT_TTL_SECONDS,
      );
      await this.redisService.setJSON(
        seckillResultKey(requestId),
        { status: 'pending' },
        SECKILL_RESULT_TTL_SECONDS,
      );
      await this.seckillQueue.add(SECKILL_CREATE_ORDER_JOB, jobData);
    } catch (e) {
      await this.refundQuota(activityId, skuId, userId);
      throw e;
    }
    return { status: 'pending', requestId };
  }

  /** 查询抢购结果：pending 处理中 / success 已建单 / fail 失败 */
  async queryResult(requestId: string) {
    const result = await this.redisService.getJSON<{
      status: string;
      orderId?: number;
      message?: string;
    }>(seckillResultKey(requestId));
    // 结果缺失（TTL 过期等）按处理中兜底，前端继续轮询/引导去订单列表
    return result ?? { status: 'pending' };
  }

  /** 建单成功：写入成功结果 */
  markSuccess(requestId: string, orderId: number) {
    return this.redisService.setJSON(
      seckillResultKey(requestId),
      { status: 'success', orderId },
      SECKILL_RESULT_TTL_SECONDS,
    );
  }

  /** 建单失败：写入失败结果 */
  markFail(requestId: string, message: string) {
    return this.redisService.setJSON(
      seckillResultKey(requestId),
      { status: 'fail', message },
      SECKILL_RESULT_TTL_SECONDS,
    );
  }

  /**
   * 回补资格（落单最终失败时的补偿）：原子地把用户从已抢集合移除并加回库存。
   * 只有「确实在集合里」才加回，天然幂等。
   */
  async refundQuota(activityId: number, skuId: number, userId: number) {
    await this.redisService.evalScript(
      `if redis.call('SREM', KEYS[1], ARGV[1]) == 1 then redis.call('INCR', KEYS[2]) end return 0`,
      [seckillUsersKey(activityId, skuId), seckillStockKey(activityId, skuId)],
      [String(userId)],
    );
  }

  // ---------- 管理端 ----------

  async adminList(query: ListSeckillActivityDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    const where: Prisma.SeckillActivityWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(keyword ? { name: { contains: keyword } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.seckillActivity.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { skus: true } } },
      }),
      this.prisma.seckillActivity.count({ where }),
    ]);
    const list = rows.map(({ _count, ...row }) => ({ ...row, skuCount: _count.skus }));
    return { list, total, page, pageSize };
  }

  async adminDetail(id: number) {
    const activity = await this.prisma.seckillActivity.findUnique({
      where: { id },
      include: {
        skus: {
          include: {
            sku: {
              include: {
                product: { select: { id: true, name: true, mainImage: true } },
                specValues: {
                  include: { specValue: { include: { group: { select: { name: true } } } } },
                },
              },
            },
          },
        },
      },
    });
    if (!activity) throw new BusinessException(ErrorCode.NOT_FOUND, '秒杀活动不存在');
    return {
      ...activity,
      skus: activity.skus.map((item) => ({
        ...item,
        sku: {
          ...item.sku,
          product: {
            ...item.sku.product,
            mainImage: this.storage.toPublicUrl(item.sku.product.mainImage),
          },
        },
      })),
    };
  }

  async createActivity(dto: CreateSeckillActivityDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    this.validateTimeRange(startTime, endTime);
    return this.prisma.seckillActivity.create({
      data: { name: dto.name, startTime, endTime, status: dto.status ?? 1 },
    });
  }

  async updateActivity(id: number, dto: UpdateSeckillActivityDto) {
    const existing = await this.ensureActivity(id);
    const startTime = dto.startTime !== undefined ? new Date(dto.startTime) : existing.startTime;
    const endTime = dto.endTime !== undefined ? new Date(dto.endTime) : existing.endTime;
    this.validateTimeRange(startTime, endTime);

    const data: Prisma.SeckillActivityUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startTime !== undefined) data.startTime = startTime;
    if (dto.endTime !== undefined) data.endTime = endTime;
    return this.prisma.seckillActivity.update({ where: { id }, data });
  }

  async removeActivity(id: number) {
    const activity = await this.ensureActivity(id);
    const now = new Date();
    if (now >= activity.startTime && now < activity.endTime) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '活动进行中，无法删除，可改为停用');
    }
    await this.prisma.seckillActivity.delete({ where: { id } });
    return null;
  }

  async addSku(activityId: number, dto: SeckillSkuDto) {
    await this.ensureActivity(activityId);
    const sku = await this.prisma.productSku.findUnique({
      where: { id: dto.skuId },
      include: { product: { select: { status: true, deletedAt: true } } },
    });
    if (!sku) throw new BusinessException(ErrorCode.NOT_FOUND, '商品不存在');
    if (sku.status !== 1 || sku.product.status !== 1 || sku.product.deletedAt) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '商品已下架，不能参加秒杀');
    }
    if (dto.seckillPrice >= sku.price) {
      throw new BusinessException(ErrorCode.PARAM_INVALID, '秒杀价必须低于商品现价');
    }
    if (dto.seckillStock > sku.stock) {
      throw new BusinessException(ErrorCode.PARAM_INVALID, '秒杀库存不能超过商品库存');
    }
    try {
      return await this.prisma.seckillActivitySku.create({
        data: {
          activityId,
          skuId: dto.skuId,
          seckillPrice: dto.seckillPrice,
          seckillStock: dto.seckillStock,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BusinessException(ErrorCode.EXISTS, '该商品已在活动中');
      }
      throw e;
    }
  }

  async updateSku(activityId: number, skuId: number, dto: UpdateSeckillSkuDto) {
    const activity = await this.ensureActivity(activityId);
    const item = await this.prisma.seckillActivitySku.findUnique({
      where: { activityId_skuId: { activityId, skuId } },
      include: { sku: true },
    });
    if (!item) throw new BusinessException(ErrorCode.NOT_FOUND, '该商品不在活动中');

    if (dto.seckillStock !== undefined) {
      // 库存只允许活动开始前改：开始后 Redis 已 SETNX，DB 改动不生效
      if (new Date() >= activity.startTime) {
        throw new BusinessException(ErrorCode.NOT_ALLOWED, '活动已开始，秒杀库存不可修改');
      }
      if (dto.seckillStock > item.sku.stock) {
        throw new BusinessException(ErrorCode.PARAM_INVALID, '秒杀库存不能超过商品库存');
      }
    }
    if (dto.seckillPrice !== undefined && dto.seckillPrice >= item.sku.price) {
      throw new BusinessException(ErrorCode.PARAM_INVALID, '秒杀价必须低于商品现价');
    }

    return this.prisma.seckillActivitySku.update({
      where: { id: item.id },
      data: {
        ...(dto.seckillPrice !== undefined ? { seckillPrice: dto.seckillPrice } : {}),
        ...(dto.seckillStock !== undefined ? { seckillStock: dto.seckillStock } : {}),
      },
    });
  }

  async removeSku(activityId: number, skuId: number) {
    await this.prisma.seckillActivitySku.deleteMany({ where: { activityId, skuId } });
    return null;
  }

  /** 在售 SKU 下拉选项（管理端给活动加商品时选择） */
  async skuOptions() {
    const skus = await this.prisma.productSku.findMany({
      where: { status: 1, stock: { gt: 0 }, product: { status: 1, deletedAt: null } },
      include: {
        product: { select: { name: true } },
        specValues: { include: { specValue: { include: { group: { select: { name: true } } } } } },
      },
      orderBy: { id: 'asc' },
    });
    return skus.map((s) => ({
      skuId: s.id,
      price: s.price,
      stock: s.stock,
      label: `${s.product.name}（${this.specText(s.specValues)}）`,
    }));
  }

  // ---------- 工具 ----------

  /**
   * 惰性初始化某 (活动, 商品) 的 Redis 秒杀库存（首次建 key，重启不重置）。
   * 配额 = min(配置秒杀库存, 物理库存)，保证秒杀不超卖物理库存。
   * 原子脚本：新建带 TTL；已存在的旧 key（升级前无 TTL）补过期时间，不覆盖已扣减的值。
   */
  private async ensureSkuStock(
    activityId: number,
    skuId: number,
    seckillStock: number,
    physicalStock: number,
    endTime: Date,
  ): Promise<void> {
    const quota = Math.min(seckillStock, physicalStock);
    await this.redisService.evalScript(
      SECKILL_INIT_STOCK_LUA,
      [seckillStockKey(activityId, skuId)],
      [seckillKeyTtlSeconds(endTime), quota],
    );
  }

  private async ensureActivity(id: number) {
    const activity = await this.prisma.seckillActivity.findUnique({ where: { id } });
    if (!activity) throw new BusinessException(ErrorCode.NOT_FOUND, '秒杀活动不存在');
    return activity;
  }

  private validateTimeRange(startTime: Date, endTime: Date): void {
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new BusinessException(ErrorCode.PARAM_INVALID, '活动时间格式不正确');
    }
    if (endTime <= startTime) {
      throw new BusinessException(ErrorCode.PARAM_INVALID, '结束时间必须晚于开始时间');
    }
  }

  private specText(
    specValues: { specValue: { value: string; group: { name: string } } }[],
  ): string {
    return specValues.map((sv) => `${sv.specValue.group.name}:${sv.specValue.value}`).join(' / ');
  }
}
