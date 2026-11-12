// 工具实现：查订单 / 查商品（通过 HTTP 调 mall-server）
//
// 瘦身原则：只返回客服回答所需的「用户可感知」字段，金额统一分→元，
// 图片 URL、内部 id、时间戳原文等对模型无用的字段一律丢弃，
// 避免把整页原始响应塞进上下文、挤爆 token 预算。
import { Injectable } from '@nestjs/common';

// 订单状态 → 可读文案（与 mall-server 的 OrderStatus 对齐）
const ORDER_STATUS_TEXT: Record<number, string> = {
  10: '待支付',
  20: '已支付（待发货）',
  30: '已发货',
  40: '已完成',
  50: '已取消',
  60: '已退款',
};

// 售后类型 → 可读文案（与 mall-server 的 RefundType 对齐）
const REFUND_TYPE_TEXT: Record<number, string> = {
  1: '仅退款',
  2: '退货退款',
};

// 售后状态 → 可读文案（与 mall-server 的 RefundStatus 对齐）
const REFUND_STATUS_TEXT: Record<number, string> = {
  10: '待商家审核',
  20: '已同意，待买家退货',
  30: '已退货，待商家收货',
  40: '退款成功',
  90: '已拒绝',
};

// mall-server 返回的原始订单列表项 / 售后 / 商品列表项（只声明用到的字段）
interface OrderListItem {
  orderNo: string;
  status: number;
  payAmount: number;
  itemCount: number;
  firstName: string;
  refund: RefundBrief | null;
  createdAt: string;
  payExpireAt: string;
}

interface RefundBrief {
  type: number;
  amount: number;
  reason: string;
  status: number;
  rejectReason?: string | null;
}

interface ProductListItem {
  id: number;
  name: string;
  subTitle: string | null;
  price: number | null;
  originalPrice: number | null;
  reviewCount: number;
  ratingAvg: number;
}

// 分 → 元（去掉多余的 ".00"，如 19900 → ¥199、19950 → ¥199.5）
function formatMoney(fen: number): string {
  return `¥${(fen / 100).toFixed(2).replace(/\.00$/, '')}`;
}

@Injectable()
export class ToolsService {
  private readonly baseUrl = process.env.MALL_SERVER_URL ?? 'http://localhost:3000/api';

  // 查订单：调 mall-server GET /api/orders（需要用户 token）
  // 注意：用户侧订单列表接口不支持按订单号过滤，这里拉取最近订单后在本地匹配订单号。
  async getOrder(orderNo: string, token: string) {
    const res = await fetch(`${this.baseUrl}/orders?page=1&pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { code: number; data: unknown; message: string };
    if (body.code !== 0) return { error: body.message };

    const list = (body.data as { list?: OrderListItem[] } | null)?.list ?? [];
    const matched = list
      .filter((o) => String(o.orderNo ?? '').includes(orderNo))
      .map((o) => this.slimOrder(o));

    if (matched.length === 0) {
      return { found: false, message: `未找到订单号含「${orderNo}」的订单` };
    }
    return { found: true, orders: matched };
  }

  // 查商品：调 mall-server GET /api/products?keyword=商品名（公开接口）
  async getProduct(keyword: string) {
    const res = await fetch(
      `${this.baseUrl}/products?keyword=${encodeURIComponent(keyword)}&page=1&pageSize=10`,
    );
    const body = (await res.json()) as { code: number; data: unknown; message: string };
    if (body.code !== 0) return { error: body.message };

    const data = body.data as { list?: ProductListItem[]; total?: number } | null;
    const list = data?.list ?? [];
    return {
      total: data?.total ?? list.length,
      products: list.map((p) => this.slimProduct(p)),
    };
  }

  // 订单瘦身：状态转文案、金额转元，只留用户关心的字段
  private slimOrder(o: OrderListItem) {
    const refund = o.refund
      ? {
          type: REFUND_TYPE_TEXT[o.refund.type] ?? String(o.refund.type),
          status: REFUND_STATUS_TEXT[o.refund.status] ?? String(o.refund.status),
          amount: formatMoney(o.refund.amount),
          reason: o.refund.reason,
          rejectReason: o.refund.rejectReason ?? null,
        }
      : null;

    return {
      orderNo: o.orderNo,
      status: ORDER_STATUS_TEXT[o.status] ?? String(o.status),
      payAmount: formatMoney(o.payAmount),
      itemCount: o.itemCount,
      productName: o.firstName,
      refund,
      createdAt: o.createdAt,
      payExpireAt: o.payExpireAt,
    };
  }

  // 商品瘦身：只留名称/副标题/价格/评分，图片 URL 对模型无用
  private slimProduct(p: ProductListItem) {
    return {
      id: p.id,
      name: p.name,
      subTitle: p.subTitle,
      price: p.price == null ? null : formatMoney(p.price),
      originalPrice: p.originalPrice == null ? null : formatMoney(p.originalPrice),
      reviewCount: p.reviewCount,
      ratingAvg: p.ratingAvg,
    };
  }
}
