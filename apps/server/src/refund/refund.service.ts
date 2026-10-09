import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PAYMENT_SERVICE, PaymentService } from '../payment/payment.service';
import { OrderStatus } from '../trade/order.constant';
import { RefundStatus, RefundType } from './refund.constant';
import { ApplyRefundDto, ListRefundDto, ReviewRefundDto, ShipBackDto } from './dto/refund.dto';

/**
 * 售后/退款：一笔订单的退款申请（仅退款 / 退货退款）+ 商家审核 + 渠道退款。
 * 状态机见 refund.constant.ts；一单同时只允许一笔进行中的售后（DB 部分唯一索引兜底）。
 */
@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_SERVICE) private readonly payment: PaymentService,
  ) {}

  /** 申请售后：仅「已支付未发货」可仅退款、「已发货」可退货退款；整单退款，金额=实付 */
  async apply(userId: number, dto: ApplyRefundDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order || order.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '订单不存在');
    }

    let type: number;
    if (order.status === OrderStatus.PAID) type = RefundType.REFUND_ONLY;
    else if (order.status === OrderStatus.SHIPPED) type = RefundType.RETURN_REFUND;
    else throw new BusinessException(ErrorCode.ORDER_STATE_INVALID, '当前订单状态不支持申请售后');

    try {
      return await this.prisma.refundOrder.create({
        data: {
          refundNo: this.genNo('R'),
          orderId: order.id,
          userId,
          type,
          amount: order.payAmount,
          reason: dto.reason,
          description: dto.description ?? null,
          status: RefundStatus.PENDING_REVIEW,
        },
      });
    } catch (e) {
      // 部分唯一索引命中：该订单已有进行中的售后
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BusinessException(ErrorCode.REFUND_EXISTS, '该订单已有进行中的售后申请');
      }
      throw e;
    }
  }

  /** 商家审核：同意（仅退款直接退款、退货退款进入待退货）/ 拒绝 */
  async review(id: number, dto: ReviewRefundDto) {
    const refund = await this.prisma.refundOrder.findUnique({ where: { id } });
    if (!refund) throw new BusinessException(ErrorCode.NOT_FOUND, '售后申请不存在');

    if (!dto.approve) {
      if (!dto.rejectReason?.trim()) {
        throw new BusinessException(ErrorCode.PARAM_INVALID, '拒绝时需填写原因');
      }
      const res = await this.prisma.refundOrder.updateMany({
        where: { id, status: RefundStatus.PENDING_REVIEW },
        data: { status: RefundStatus.REJECTED, rejectReason: dto.rejectReason },
      });
      if (res.count === 0) {
        throw new BusinessException(ErrorCode.REFUND_STATE_INVALID, '当前状态不可审核');
      }
      return null;
    }

    if (refund.type === RefundType.REFUND_ONLY) {
      await this.completeRefund(id, RefundStatus.PENDING_REVIEW);
    } else {
      const res = await this.prisma.refundOrder.updateMany({
        where: { id, status: RefundStatus.PENDING_REVIEW },
        data: { status: RefundStatus.APPROVED_WAIT_RETURN },
      });
      if (res.count === 0) {
        throw new BusinessException(ErrorCode.REFUND_STATE_INVALID, '当前状态不可审核');
      }
    }
    return null;
  }

  /** 买家填写退货物流（审核通过后，退货退款） */
  async shipBack(userId: number, id: number, dto: ShipBackDto) {
    const refund = await this.prisma.refundOrder.findUnique({ where: { id } });
    if (!refund || refund.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '售后申请不存在');
    }
    const res = await this.prisma.refundOrder.updateMany({
      where: { id, status: RefundStatus.APPROVED_WAIT_RETURN },
      data: {
        status: RefundStatus.RETURNED_WAIT_RECEIVE,
        logisticsCompany: dto.logisticsCompany,
        logisticsNo: dto.logisticsNo,
      },
    });
    if (res.count === 0) {
      throw new BusinessException(ErrorCode.REFUND_STATE_INVALID, '当前状态不可填写退货物流');
    }
    return null;
  }

  /** 商家确认收货并退款（退货退款） */
  async confirmReceipt(id: number) {
    await this.completeRefund(id, RefundStatus.RETURNED_WAIT_RECEIVE);
    return null;
  }

  /**
   * 执行退款：渠道退款 → 回补物理库存 + 订单置已退款 + 售后置退款成功（乐观锁）。
   * 不退优惠券（已核销）、不回补秒杀 Redis 配额（仅回物理库存）。
   */
  private async completeRefund(refundId: number, fromStatus: number) {
    const refund = await this.prisma.refundOrder.findUnique({
      where: { id: refundId },
      include: { order: { include: { items: true } } },
    });
    if (!refund) throw new BusinessException(ErrorCode.NOT_FOUND, '售后申请不存在');

    // 渠道退款（refundNo 幂等）；失败则停在原状态，由管理端重试
    const { refundTransactionId } = await this.payment.refund(
      refund.order.orderNo,
      refund.refundNo,
      refund.amount,
    );

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.refundOrder.updateMany({
        where: { id: refundId, status: fromStatus },
        data: {
          status: RefundStatus.REFUNDED,
          refundTransactionId,
          refundedAt: new Date(),
        },
      });
      if (res.count === 0) {
        throw new BusinessException(ErrorCode.REFUND_STATE_INVALID, '当前状态不可退款');
      }

      for (const item of refund.order.items) {
        await tx.productSku.update({
          where: { id: item.skuId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.order.updateMany({
        where: { id: refund.orderId, status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED] } },
        data: { status: OrderStatus.REFUNDED },
      });
    });
  }

  // ---------- 查询 ----------

  async mine(userId: number) {
    return this.prisma.refundOrder.findMany({
      where: { userId },
      include: { order: { select: { orderNo: true, status: true } } },
      orderBy: { id: 'desc' },
    });
  }

  async detail(userId: number, id: number) {
    const refund = await this.prisma.refundOrder.findUnique({
      where: { id },
      include: { order: { select: { orderNo: true, status: true } } },
    });
    if (!refund || refund.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '售后申请不存在');
    }
    return refund;
  }

  async adminList(query: ListRefundDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    const where: Prisma.RefundOrderWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(keyword ? { refundNo: { contains: keyword } } : {}),
    };
    const [list, total] = await Promise.all([
      this.prisma.refundOrder.findMany({
        where,
        include: {
          order: { select: { orderNo: true, status: true } },
          user: { select: { id: true, phone: true, nickname: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.refundOrder.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async adminDetail(id: number) {
    const refund = await this.prisma.refundOrder.findUnique({
      where: { id },
      include: {
        order: { include: { items: true } },
        user: { select: { id: true, phone: true, nickname: true } },
      },
    });
    if (!refund) throw new BusinessException(ErrorCode.NOT_FOUND, '售后申请不存在');
    return refund;
  }

  // ---------- 工具 ----------

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
