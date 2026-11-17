// 工具实现：查订单 / 查商品（通过 HTTP 调 mall-server）
//
// 瘦身原则：只返回客服回答所需的「用户可感知」字段，金额统一分→元，
// 图片 URL、内部 id、时间戳原文等对模型无用的字段一律丢弃，
// 避免把整页原始响应塞进上下文、挤爆 token 预算。
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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
  id: number;
  orderNo: string;
  status: number;
  payAmount: number;
  itemCount: number;
  firstName: string;
  firstImage: string | null;
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
  brandName: string | null;
  mainImage: string | null;
  skuId: number | null;
  reviewCount: number;
  ratingAvg: number;
}

interface AddressItem {
  id: number;
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: number;
}

interface OrderDraftItem {
  skuId: number;
  quantity: number;
  name: string;
  price: number; // 分
  image?: string | null;
}

// 分 → 元（去掉多余的 ".00"，如 19900 → ¥199、19950 → ¥199.5）
function formatMoney(fen: number): string {
  return `¥${(fen / 100).toFixed(2).replace(/\.00$/, '')}`;
}

// 带超时 + 退避重试的 fetch：网络抖动/超时自动重试，成功返回解析后的 JSON。
// 只重试「网络层」失败（fetch 抛错 / 超时）；HTTP 有响应就交给调用方按 code 判断。
async function fetchJson(url: string, init: RequestInit = {}, retries = 2): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// ==================== db_query：只读查库（自然语言 → SQL） ====================
// 只允许查询公共业务表（商品/分类/品牌/评价/营销），排除用户订单、admin、会员等敏感数据。
// 用户个人数据（订单等）走 getOrders 工具（带用户鉴权），不走 db_query。
const ALLOWED_TABLES = new Set([
  'product',
  'product_sku',
  'product_spec_group',
  'product_spec_value',
  'product_image',
  'sku_spec_value',
  'brand',
  'category',
  'product_review',
  'home_slot',
  'seckill_activity',
  'seckill_activity_sku',
  'coupon',
]);

// 危险关键字：拒绝一切写操作 / DDL / 权限 / 会话相关关键字
const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|vacuum|copy|call|merge|replace|into|execute|prepare|listen|notify|load|begin|commit|rollback|set|reset)\b/i;

/** 校验只读查询：单条 SELECT、无危险关键字、只查白名单表。返回错误信息，null 表示通过。 */
function validateReadQuery(sql: string): string | null {
  const stmts = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (stmts.length !== 1) return '只允许单条查询语句';
  const stmt = stmts[0];
  if (!/^select\b/i.test(stmt) && !/^with\b/i.test(stmt)) return '仅支持 SELECT 查询';
  if (FORBIDDEN_KEYWORDS.test(stmt)) return 'SQL 包含不允许的关键字';

  // 表白名单：提取 from / join 后的表名（忽略 public. 前缀），必须都在白名单内
  const tableRe = /(?:from|join)\s+(?:public\.)?["']?([a-z_][a-z0-9_]*)["']?/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(stmt)) !== null) {
    if (!ALLOWED_TABLES.has(m[1].toLowerCase())) {
      return `不允许查询表 ${m[1]}`;
    }
  }
  return null;
}

@Injectable()
export class ToolsService {
  private readonly baseUrl = process.env.MALL_SERVER_URL ?? 'http://localhost:3000/api';

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // 只读查库：执行白名单校验后的 SELECT，返回结果集（最多 50 行），供模型总结回答
  async dbQuery(sql: string) {
    const error = validateReadQuery(sql);
    if (error) return { error, hint: '换个查询方式或改用 getProducts/getOrders 等工具' };

    try {
      const rows = (await this.prisma.$queryRawUnsafe(sql)) as unknown as Array<
        Record<string, unknown>
      >;
      const list = Array.isArray(rows) ? rows.slice(0, 50) : [];
      const columns = list.length > 0 ? Object.keys(list[0]) : [];
      return { columns, rows: list, rowCount: list.length };
    } catch (e) {
      return {
        error: `查询失败：${e instanceof Error ? e.message : e}`,
        hint: '简化 SQL 或换个查询条件重试',
      };
    }
  }

  // 查订单：调 mall-server GET /api/orders（需要用户 token）
  // 订单号/状态都可选：不传则列出全部订单，传 orderNo 查某个订单，传 status 按状态筛选。
  async getOrders(args: { orderNo?: string; status?: number }, token: string) {
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '50');
    if (args.status != null) params.set('status', String(args.status));

    let body: { code: number; data: unknown; message: string };
    try {
      body = (await fetchJson(`${this.baseUrl}/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })) as typeof body;
    } catch {
      return { error: '查询订单失败', hint: '稍后重试', orders: [] };
    }
    if (body.code !== 0) return { error: body.message, orders: [] };

    let list = (body.data as { list?: OrderListItem[] } | null)?.list ?? [];
    // 订单号接口不支持过滤，本地按 orderNo 子串匹配
    if (args.orderNo) {
      list = list.filter((o) => String(o.orderNo ?? '').includes(args.orderNo!));
    }

    const orders = list.map((o) => this.slimOrder(o));
    if (orders.length === 0) {
      return {
        empty: true,
        total: 0,
        orders,
        hint: args.orderNo
          ? `没有找到订单号含「${args.orderNo}」的订单，可换订单号或让用户用「我的订单」看全部`
          : '你还没有订单',
      };
    }
    return { total: orders.length, orders };
  }

  // 检索/筛选商品：调 mall-server GET /api/products（支持关键词/品牌/价格区间，公开接口）
  async getProducts(args: {
    keyword?: string;
    brand?: string;
    priceMin?: number;
    priceMax?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (args.keyword) params.set('keyword', args.keyword);
    if (args.brand) params.set('brand', args.brand);
    // 价格：模型给「元」，接口要「分」
    if (args.priceMin != null) params.set('priceMin', String(Math.round(args.priceMin * 100)));
    if (args.priceMax != null) params.set('priceMax', String(Math.round(args.priceMax * 100)));
    params.set('page', '1');
    params.set('pageSize', String(args.limit ?? 5));

    let body: { code: number; data: unknown; message: string };
    try {
      body = (await fetchJson(`${this.baseUrl}/products?${params.toString()}`)) as typeof body;
    } catch {
      return { error: '查询商品失败', hint: '稍后重试', products: [] };
    }
    if (body.code !== 0) return { error: body.message, products: [] };

    const data = body.data as { list?: ProductListItem[]; total?: number } | null;
    const list = data?.list ?? [];
    const products = list.map((p) => this.slimProduct(p));
    if (products.length === 0) {
      return {
        empty: true,
        total: 0,
        products,
        hint: '没有符合条件的商品，可放宽关键词/品牌/价格区间后再查一次',
      };
    }
    return {
      total: data?.total ?? products.length,
      products,
    };
  }

  // 订单瘦身：保留原始状态码（前端渲染操作按钮用）+ 状态文案 + 商品图/订单 id
  private slimOrder(o: OrderListItem) {
    const refund = o.refund
      ? {
          type: REFUND_TYPE_TEXT[o.refund.type] ?? String(o.refund.type),
          status: REFUND_STATUS_TEXT[o.refund.status] ?? String(o.refund.status),
          statusCode: o.refund.status,
          amount: formatMoney(o.refund.amount),
          reason: o.refund.reason,
          rejectReason: o.refund.rejectReason ?? null,
        }
      : null;

    return {
      id: o.id,
      orderNo: o.orderNo,
      status: o.status, // 原始状态码
      statusText: ORDER_STATUS_TEXT[o.status] ?? String(o.status),
      payAmount: formatMoney(o.payAmount),
      itemCount: o.itemCount,
      productName: o.firstName,
      image: o.firstImage,
      refund,
      createdAt: o.createdAt,
      payExpireAt: o.payExpireAt,
    };
  }

  // 查收货地址：调 mall-server GET /api/addresses（需要用户 token）
  async getAddresses(token: string) {
    let body: { code: number; data: unknown; message: string };
    try {
      body = (await fetchJson(`${this.baseUrl}/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      })) as typeof body;
    } catch {
      return { error: '查询地址失败', hint: '稍后重试', addresses: [] };
    }
    if (body.code !== 0) return { error: body.message, addresses: [] };

    const list = (body.data as AddressItem[] | null) ?? [];
    const addresses = list.map((a) => ({
      id: a.id,
      receiverName: a.receiverName,
      receiverPhone: a.receiverPhone,
      fullAddress: `${a.province}${a.city}${a.district}${a.detail}`,
      isDefault: a.isDefault,
    }));
    if (addresses.length === 0) {
      return {
        empty: true,
        total: 0,
        addresses,
        hint: '用户还没有收货地址，引导其先去「地址管理」添加地址',
      };
    }
    return { total: addresses.length, addresses };
  }

  // 生成订单草稿（不真正下单）：组装结构化草稿，前端渲染确认卡片，用户确认后才由前端真正下单。
  // 金额单位：分。price 来自 getProducts 的 priceCent，totalAmount 由后端汇总计算。
  async createOrderDraft(args: {
    items: OrderDraftItem[];
    address: { id: number; receiverName: string; receiverPhone: string; fullAddress: string };
  }) {
    const items = args.items.map((it) => ({ ...it, subtotal: it.price * it.quantity }));
    const totalAmount = items.reduce((s, it) => s + it.subtotal, 0);
    const itemCount = items.reduce((s, it) => s + it.quantity, 0);
    return {
      items,
      address: args.address,
      totalAmount,
      totalText: formatMoney(totalAmount),
      itemCount,
    };
  }

  // 商品瘦身：留名称/品牌/副标题/价格/评分/图/最低价 SKU
  // price 为展示用（元），priceCent 为购买下单用（分），image/skuId 供前端渲染商品卡片
  private slimProduct(p: ProductListItem) {
    return {
      id: p.id,
      name: p.name,
      brand: p.brandName,
      subTitle: p.subTitle,
      price: p.price == null ? null : formatMoney(p.price),
      priceCent: p.price,
      originalPrice: p.originalPrice == null ? null : formatMoney(p.originalPrice),
      image: p.mainImage,
      skuId: p.skuId,
      reviewCount: p.reviewCount,
      ratingAvg: p.ratingAvg,
    };
  }
}
