import { Injectable } from '@nestjs/common';
import type { Coupon, Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { CouponType, UserCouponStatus } from './coupon.constant';
import { CreateCouponDto, ListCouponDto, UpdateCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- 管理端 ----------

  async adminList(query: ListCouponDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    const where: Prisma.CouponWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(keyword ? { name: { contains: keyword } } : {}),
    };
    const [list, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async adminDetail(id: number) {
    return this.ensure(id);
  }

  async create(dto: CreateCouponDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    this.validateTimeRange(startTime, endTime);
    return this.prisma.coupon.create({
      data: {
        name: dto.name,
        type: dto.type,
        thresholdAmount: dto.thresholdAmount ?? 0,
        discountAmount: dto.discountAmount ?? 0,
        discountRate: dto.discountRate ?? 0,
        totalStock: dto.totalStock,
        perUserLimit: dto.perUserLimit ?? 1,
        startTime,
        endTime,
        status: dto.status ?? 1,
        description: dto.description ?? null,
      },
    });
  }

  async update(id: number, dto: UpdateCouponDto) {
    const existing = await this.ensure(id);
    const startTime = dto.startTime !== undefined ? new Date(dto.startTime) : existing.startTime;
    const endTime = dto.endTime !== undefined ? new Date(dto.endTime) : existing.endTime;
    this.validateTimeRange(startTime, endTime);

    const data: Prisma.CouponUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.thresholdAmount !== undefined) data.thresholdAmount = dto.thresholdAmount;
    if (dto.discountAmount !== undefined) data.discountAmount = dto.discountAmount;
    if (dto.discountRate !== undefined) data.discountRate = dto.discountRate;
    if (dto.perUserLimit !== undefined) data.perUserLimit = dto.perUserLimit;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.startTime !== undefined) data.startTime = startTime;
    if (dto.endTime !== undefined) data.endTime = endTime;

    return this.prisma.coupon.update({ where: { id }, data });
  }

  async remove(id: number) {
    const coupon = await this.ensure(id);
    if (coupon.receivedCount > 0) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '已有人领取，无法删除，可改为停用');
    }
    await this.prisma.coupon.delete({ where: { id } });
    return null;
  }

  // ---------- C 端 ----------

  /** 领券中心（公开）：所有启用且未结束的券 */
  async storeList() {
    return this.prisma.coupon.findMany({
      where: { status: 1, endTime: { gt: new Date() } },
      orderBy: { id: 'desc' },
    });
  }

  /** 领券：校验有效性 → 限领 → 原子扣库存（防超发）→ 落一条 UserCoupon */
  async receive(userId: number, couponId: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '优惠券不存在');
    }
    if (coupon.status !== 1) {
      throw new BusinessException(ErrorCode.COUPON_RECEIVE_FAILED, '优惠券已停用');
    }
    const now = new Date();
    if (now < coupon.startTime) {
      throw new BusinessException(ErrorCode.COUPON_RECEIVE_FAILED, '优惠券尚未开始');
    }
    if (now > coupon.endTime) {
      throw new BusinessException(ErrorCode.COUPON_RECEIVE_FAILED, '优惠券已过期');
    }

    return this.prisma.$transaction(async (tx) => {
      // 每人限领（尽力校验；超发主要由下面的 CAS 兜底）
      if (coupon.perUserLimit > 0) {
        const count = await tx.userCoupon.count({ where: { userId, couponId } });
        if (count >= coupon.perUserLimit) {
          throw new BusinessException(ErrorCode.COUPON_RECEIVE_FAILED, '已达每人限领上限');
        }
      }
      // 原子扣库存：receivedCount 到 totalStock 即领满，防止并发超发
      const res = await tx.coupon.updateMany({
        where: { id: couponId, receivedCount: { lt: coupon.totalStock } },
        data: { receivedCount: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new BusinessException(ErrorCode.COUPON_RECEIVE_FAILED, '优惠券已被领完');
      }
      return tx.userCoupon.create({
        data: { userId, couponId },
        select: { id: true, couponId: true, status: true, receivedAt: true },
      });
    });
  }

  /** 我的券：返回用户领到的所有券 + 券模板信息 + 是否过期（未使用且已过有效期） */
  async mine(userId: number) {
    const now = new Date();
    const list = await this.prisma.userCoupon.findMany({
      where: { userId },
      include: { coupon: true },
      orderBy: { id: 'desc' },
    });
    return list.map((uc) => ({
      id: uc.id,
      status: uc.status,
      receivedAt: uc.receivedAt,
      usedAt: uc.usedAt,
      expired: uc.status === UserCouponStatus.UNUSED && now > uc.coupon.endTime,
      coupon: uc.coupon,
    }));
  }

  // ---------- 下单用券 / 取消回退（在订单事务内调用） ----------

  /**
   * 下单选券：校验归属/未使用/启用/有效期/门槛，原子标记「已使用」防一券多用。
   * 在订单事务内执行：任一后续步骤失败整体回滚，券的占用也随之撤销。
   * @returns 优惠金额（分）
   */
  async useInOrder(
    tx: Prisma.TransactionClient,
    userId: number,
    userCouponId: number,
    totalAmount: number,
  ): Promise<{ discount: number }> {
    const userCoupon = await tx.userCoupon.findUnique({
      where: { id: userCouponId },
      include: { coupon: true },
    });
    if (!userCoupon || userCoupon.userId !== userId) {
      throw new BusinessException(ErrorCode.COUPON_UNAVAILABLE, '优惠券不存在');
    }
    if (userCoupon.status !== UserCouponStatus.UNUSED) {
      throw new BusinessException(ErrorCode.COUPON_UNAVAILABLE, '优惠券已使用');
    }
    const coupon = userCoupon.coupon;
    if (coupon.status !== 1) {
      throw new BusinessException(ErrorCode.COUPON_UNAVAILABLE, '优惠券已停用');
    }
    const now = new Date();
    if (now < coupon.startTime || now > coupon.endTime) {
      throw new BusinessException(ErrorCode.COUPON_UNAVAILABLE, '优惠券不在有效期内');
    }
    if (totalAmount < coupon.thresholdAmount) {
      throw new BusinessException(
        ErrorCode.COUPON_UNAVAILABLE,
        `未满足使用门槛（满 ¥${(coupon.thresholdAmount / 100).toFixed(2)} 可用）`,
      );
    }

    const discount = Math.min(this.computeDiscount(coupon, totalAmount), totalAmount);
    // 原子占用：两单并发用同一张券，只有一单能成功
    const res = await tx.userCoupon.updateMany({
      where: { id: userCouponId, userId, status: UserCouponStatus.UNUSED },
      data: { status: UserCouponStatus.USED, usedAt: new Date() },
    });
    if (res.count === 0) {
      throw new BusinessException(ErrorCode.COUPON_UNAVAILABLE, '优惠券已被使用');
    }
    return { discount };
  }

  /** 取消订单时回退券：把已占用（已使用）的券重新置为未使用 */
  async refundInCancel(tx: Prisma.TransactionClient, userCouponId: number): Promise<void> {
    await tx.userCoupon.updateMany({
      where: { id: userCouponId, status: UserCouponStatus.USED },
      data: { status: UserCouponStatus.UNUSED, usedAt: null },
    });
  }

  // ---------- 工具 ----------

  /** 计算优惠金额（分）：满减直接减；折扣按 round(总额 × 折扣率 / 100) 后的差额 */
  computeDiscount(
    coupon: Pick<Coupon, 'type' | 'discountAmount' | 'discountRate'>,
    totalAmount: number,
  ): number {
    if (coupon.type === CouponType.FULL_REDUCTION) {
      return coupon.discountAmount;
    }
    const pay = Math.round((totalAmount * coupon.discountRate) / 100);
    return totalAmount - pay;
  }

  private async ensure(id: number): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '优惠券不存在');
    }
    return coupon;
  }

  private validateTimeRange(startTime: Date, endTime: Date): void {
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new BusinessException(ErrorCode.PARAM_INVALID, '有效期时间格式不正确');
    }
    if (endTime <= startTime) {
      throw new BusinessException(ErrorCode.PARAM_INVALID, '结束时间必须晚于开始时间');
    }
  }
}
