import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../trade/order.constant';

/** 成交口径：已支付及之后（待发货/已发货/已完成）才算销售额，待支付/已取消不计入 */
const PAID_STATUSES = [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED];

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const todayStart = this.startOfDay(new Date());
    const trendDays = 7;
    const trendStart = this.addDays(todayStart, -(trendDays - 1));

    const [
      totalUsers,
      totalProducts,
      todayUsers,
      todayProducts,
      totalOrders,
      totalSales,
      todayOrders,
      todaySales,
      statusGroup,
      hotGroup,
      trend,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: 1 } }),
      this.prisma.product.count({ where: { deletedAt: null, status: 1 } }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.product.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        where: { status: { in: PAID_STATUSES } },
        _sum: { payAmount: true },
      }),
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: todayStart }, status: { in: PAID_STATUSES } },
        _sum: { payAmount: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { order: { status: { in: PAID_STATUSES } } },
        _sum: { quantity: true, totalAmount: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      this.loadTrend(trendStart, trendDays),
    ]);

    return {
      totalUsers,
      totalProducts,
      todayUsers,
      todayProducts,
      totalOrders,
      totalSales: totalSales._sum.payAmount ?? 0,
      todayOrders,
      todaySales: todaySales._sum.payAmount ?? 0,
      orderStatus: statusGroup
        .map((g) => ({ status: g.status, count: g._count._all }))
        .sort((a, b) => a.status - b.status),
      hotProducts: hotGroup.map((h) => ({
        productId: h.productId,
        productName: h.productName,
        quantity: h._sum.quantity ?? 0,
        amount: h._sum.totalAmount ?? 0,
      })),
      salesTrend: trend,
    };
  }

  /** 近 N 天趋势：按天逐段聚合（避免拉全量订单到内存分桶），天与天之间并行查询 */
  private async loadTrend(start: Date, days: number) {
    const rows = await Promise.all(
      Array.from({ length: days }, (_, i) => {
        const dayStart = this.addDays(start, i);
        const dayEnd = this.addDays(dayStart, 1);
        return this.prisma.order.aggregate({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
            status: { in: PAID_STATUSES },
          },
          _count: true,
          _sum: { payAmount: true },
        });
      }),
    );

    return rows.map((r, i) => ({
      date: this.formatDay(this.addDays(start, i)),
      orderCount: r._count,
      salesAmount: r._sum.payAmount ?? 0,
    }));
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private addDays(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  private formatDay(d: Date): string {
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
