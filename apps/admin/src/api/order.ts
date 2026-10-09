import request from './request';
import type { PageQuery, PageResult } from './system';

export interface OrderItemRow {
  id: number;
  orderId: number;
  skuId: number;
  productId: number;
  productName: string;
  skuSpec: string;
  productImage: string | null;
  price: number;
  quantity: number;
  totalAmount: number;
}

export interface OrderRow {
  id: number;
  orderNo: string;
  userId: number;
  totalAmount: number;
  freightAmount: number;
  discountAmount: number;
  payAmount: number;
  status: number;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  remark: string | null;
  logisticsCompany: string | null;
  logisticsNo: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  user: { id: number; phone: string; nickname: string };
  items: OrderItemRow[];
  userCoupon: { coupon: { name: string } } | null;
}

export interface ListOrderParams extends PageQuery {
  status?: number;
}

export const ORDER_STATUS: Record<number, { text: string; color: string }> = {
  10: { text: '待支付', color: 'orange' },
  20: { text: '待发货', color: 'blue' },
  30: { text: '已发货', color: 'cyan' },
  40: { text: '已完成', color: 'green' },
  50: { text: '已取消', color: 'default' },
  60: { text: '已退款', color: 'magenta' },
};

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS).map(([value, v]) => ({
  value: Number(value),
  label: v.text,
}));

export const listOrders = (params: ListOrderParams) =>
  request.get<{ code: number; data: PageResult<OrderRow>; message: string }>('/admin/orders', {
    params,
  });

export const getOrder = (id: number) =>
  request.get<{ code: number; data: OrderRow; message: string }>(`/admin/orders/${id}`);

export const shipOrder = (id: number, data: { logisticsCompany: string; logisticsNo: string }) =>
  request.post(`/admin/orders/${id}/ship`, data);
