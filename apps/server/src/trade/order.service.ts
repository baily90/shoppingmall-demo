import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PAYMENT_SERVICE, PaymentService } from '../payment/payment.service';
import { CreateOrderDto, ListOrderDto, ShipOrderDto } from './dto/order.dto';
import {
  AUTO_CANCEL_JOB,
  DEFAULT_PAY_TIMEOUT_SECONDS,
  OrderStatus,
  ORDER_QUEUE,
  PaymentChannel,
  PaymentStatus,
} from './order.constant';

@Injectable()
export class OrderService {
  /** 待支付超时毫秒数（下单后 delay 这么久自动取消） */
  private readonly payTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_SERVICE) private readonly payment: PaymentService,
    @InjectQueue(ORDER_QUEUE) private readonly orderQueue: Queue,
    configService: ConfigService,
  ) {
    this.payTimeoutMs =
      Number(configService.get('ORDER_PAY_TIMEOUT_SECONDS', DEFAULT_PAY_TIMEOUT_SECONDS)) * 1000;
  }

  async create(userId: number, dto: CreateOrderDto) {
    // 幂等：同一 idempotencyKey 重复提交（如双击/重试）直接返回已有订单，不重复扣库存
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return { id: existing.id, orderNo: existing.orderNo };
      }
    }

    const address = await this.prisma.userAddress.findUnique({ where: { id: dto.addressId } });
    if (!address || address.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '收货地址不存在');
    }

    // 同一 SKU 出现多次时合并数量
    const qtyMap = new Map<number, number>();
    for (const it of dto.items) {
      qtyMap.set(it.skuId, (qtyMap.get(it.skuId) ?? 0) + it.quantity);
    }
    const skuIds = [...qtyMap.keys()];

    const skus = await this.prisma.productSku.findMany({
      where: { id: { in: skuIds } },
      include: {
        product: {
          select: { id: true, name: true, mainImage: true, status: true, deletedAt: true },
        },
        specValues: { include: { specValue: { include: { group: { select: { name: true } } } } } },
      },
    });
    if (skus.length !== skuIds.length) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '存在无效的 SKU');
    }
    const skuMap = new Map(skus.map((s) => [s.id, s]));

    const orderNo = this.genNo('NO');
    const receiverAddress = this.joinAddress(address);

    let orderId: number;
    try {
      orderId = await this.prisma.$transaction(async (tx) => {
        let total = 0;
        for (const [skuId, qty] of qtyMap) {
          const sku = skuMap.get(skuId)!;
          if (sku.status !== 1 || sku.product.status !== 1 || sku.product.deletedAt) {
            throw new BusinessException(ErrorCode.NOT_ALLOWED, `「${sku.product.name}」已下架`);
          }
          // 原子扣库存：库存不足时 count=0 → 抛错整体回滚，防止超卖
          const res = await tx.productSku.updateMany({
            where: { id: skuId, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          });
          if (res.count === 0) {
            throw new BusinessException(ErrorCode.OUT_OF_STOCK, `「${sku.product.name}」库存不足`);
          }
          total += sku.price * qty;
        }

        const order = await tx.order.create({
          data: {
            orderNo,
            userId,
            idempotencyKey: dto.idempotencyKey ?? null,
            totalAmount: total,
            freightAmount: 0,
            payAmount: total,
            status: OrderStatus.PENDING_PAYMENT,
            receiverName: address.receiverName,
            receiverPhone: address.receiverPhone,
            receiverAddress,
            remark: dto.remark ?? null,
          },
        });

        await tx.orderItem.createMany({
          data: [...qtyMap].map(([skuId, qty]) => {
            const sku = skuMap.get(skuId)!;
            return {
              orderId: order.id,
              skuId,
              productId: sku.product.id,
              productName: sku.product.name,
              skuSpec: this.specText(sku.specValues),
              productImage: sku.image ?? sku.product.mainImage,
              price: sku.price,
              quantity: qty,
              totalAmount: sku.price * qty,
            };
          }),
        });

        // 下单成功后清掉购物车里这些 SKU（覆盖「购物车结算」和「立即购买」两个入口）
        await tx.cart.deleteMany({ where: { userId, skuId: { in: skuIds } } });

        return order.id;
      });
    } catch (e) {
      // 并发下同一幂等键同时提交：唯一键冲突后回读已创建订单，视为成功（幂等）
      if (
        dto.idempotencyKey &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const existing = await this.prisma.order.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          return { id: existing.id, orderNo: existing.orderNo };
        }
      }
      throw e;
    }

    // 塞一个延迟任务：到点仍未支付则自动取消（失败不阻断下单，仅记日志）
    try {
      await this.orderQueue.add(AUTO_CANCEL_JOB, { orderId }, { delay: this.payTimeoutMs });
    } catch (e) {
      console.warn('[order] 自动取消任务入队失败，订单需手动取消兜底:', e);
    }

    return { id: orderId, orderNo };
  }

  async pay(userId: number, orderId: number) {
    const order = await this.ensureOwn(userId, orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BusinessException(ErrorCode.ORDER_STATE_INVALID, '订单当前状态不可支付');
    }

    const paymentNo = this.genNo('P');
    const { transactionId } = await this.payment.createPayment(order.orderNo, order.payAmount);

    let paid = false;
    await this.prisma.$transaction(async (tx) => {
      // 乐观锁：仅当订单仍为待支付时才置为已支付，防止并发重复支付 / 与自动取消竞态
      const res = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING_PAYMENT },
        data: { status: OrderStatus.PAID, paidAt: new Date() },
      });
      if (res.count === 0) return; // 已被取消/已支付，放弃，不落支付记录
      paid = true;
      await tx.payment.create({
        data: {
          paymentNo,
          orderId,
          userId,
          amount: order.payAmount,
          channel: PaymentChannel.MOCK,
          status: PaymentStatus.PAID,
          transactionId,
          paidAt: new Date(),
        },
      });
    });

    if (!paid) {
      throw new BusinessException(ErrorCode.ORDER_STATE_INVALID, '订单当前状态不可支付');
    }
    return null;
  }

  async cancel(userId: number, orderId: number) {
    await this.ensureOwn(userId, orderId);
    const canceled = await this.cancelPendingOrder(orderId);
    if (!canceled) {
      throw new BusinessException(ErrorCode.ORDER_STATE_INVALID, '仅待支付订单可取消');
    }
    return null;
  }

  /**
   * 核心取消动作：不依赖 userId，用户手动取消和定时/延迟自动取消共用。
   * 乐观锁：仅当订单仍为「待支付」时才取消并释放库存，返回是否真正取消。
   * 与「支付」并发时靠 where 里的 status 判断，两个动作只会有一个成功（幂等）。
   */
  async cancelPendingOrder(orderId: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING_PAYMENT },
        data: { status: OrderStatus.CANCELED, canceledAt: new Date() },
      });
      if (res.count === 0) return false; // 已支付/已取消/不存在，跳过

      // 释放下单时扣掉的库存
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const it of items) {
        await tx.productSku.update({
          where: { id: it.skuId },
          data: { stock: { increment: it.quantity } },
        });
      }
      return true;
    });
  }

  async confirm(userId: number, orderId: number) {
    const order = await this.ensureOwn(userId, orderId);
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BusinessException(ErrorCode.ORDER_STATE_INVALID, '仅已发货订单可确认收货');
    }
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
    });
    return null;
  }

  async list(userId: number, query: ListOrderDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      list: orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        status: o.status,
        totalAmount: o.totalAmount,
        payAmount: o.payAmount,
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        firstImage: o.items[0]?.productImage ?? null,
        firstName: o.items[0]?.productName ?? '',
        createdAt: o.createdAt,
        payExpireAt: this.payExpireAt(o.createdAt),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 各状态订单数（用于「我的」页角标） */
  async counts(userId: number) {
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    });
    const statusCounts: Record<string, number> = {};
    for (const r of rows) statusCounts[String(r.status)] = r._count.status;
    const total = rows.reduce((sum, r) => sum + r._count.status, 0);
    return { total, statusCounts };
  }

  async detail(userId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '订单不存在');
    }
    return { ...order, payExpireAt: this.payExpireAt(order.createdAt) };
  }

  // ---------- 管理端 ----------

  async adminList(query: ListOrderDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    const where: Prisma.OrderWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(keyword ? { orderNo: { contains: keyword } } : {}),
    };

    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          user: { select: { id: true, phone: true, nickname: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  async adminDetail(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: { select: { id: true, phone: true, nickname: true } },
      },
    });
    if (!order) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '订单不存在');
    }
    return order;
  }

  async ship(orderId: number, dto: ShipOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '订单不存在');
    }
    if (order.status !== OrderStatus.PAID) {
      throw new BusinessException(ErrorCode.ORDER_STATE_INVALID, '仅已支付订单可发货');
    }
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SHIPPED,
        logisticsCompany: dto.logisticsCompany,
        logisticsNo: dto.logisticsNo,
        shippedAt: new Date(),
      },
    });
    return null;
  }

  // ---------- 私有工具 ----------

  private async ensureOwn(userId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '订单不存在');
    }
    return order;
  }

  private joinAddress(a: {
    province: string;
    city: string;
    district: string;
    detail: string;
  }): string {
    return `${a.province}${a.city}${a.district}${a.detail}`;
  }

  /** 支付截止时间：下单时间 + 超时时长（供 H5 展示倒计时） */
  private payExpireAt(createdAt: Date): Date {
    return new Date(createdAt.getTime() + this.payTimeoutMs);
  }

  private specText(
    specValues: { specValue: { value: string; group: { name: string } } }[],
  ): string {
    return specValues.map((sv) => `${sv.specValue.group.name}:${sv.specValue.value}`).join(' / ');
  }

  /** 生成业务单号：前缀 + 时间戳(毫秒) + 6 位随机数 */
  private genNo(prefix: string): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts =
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
      String(d.getMilliseconds()).padStart(3, '0');
    const rand = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    return `${prefix}${ts}${rand}`;
  }
}
