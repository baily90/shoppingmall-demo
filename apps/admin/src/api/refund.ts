import request from './request';
import type { PageQuery, PageResult } from './system';
import type { OrderItemRow } from './order';

export interface RefundRow {
  id: number;
  refundNo: string;
  orderId: number;
  userId: number;
  type: number;
  amount: number;
  reason: string;
  description: string | null;
  status: number;
  logisticsCompany: string | null;
  logisticsNo: string | null;
  rejectReason: string | null;
  refundTransactionId: string | null;
  refundedAt: string | null;
  createdAt: string;
  order: { orderNo: string; status: number };
  user: { id: number; phone: string; nickname: string };
}

export interface RefundDetail {
  id: number;
  refundNo: string;
  orderId: number;
  userId: number;
  type: number;
  amount: number;
  reason: string;
  description: string | null;
  status: number;
  logisticsCompany: string | null;
  logisticsNo: string | null;
  rejectReason: string | null;
  refundTransactionId: string | null;
  refundedAt: string | null;
  createdAt: string;
  order: { orderNo: string; status: number; items: OrderItemRow[] };
  user: { id: number; phone: string; nickname: string };
}

export const REFUND_TYPE_TEXT: Record<number, string> = {
  1: '仅退款',
  2: '退货退款',
};

export const REFUND_STATUS: Record<number, { text: string; color: string }> = {
  10: { text: '待审核', color: 'orange' },
  20: { text: '待买家退货', color: 'blue' },
  30: { text: '待商家收货', color: 'cyan' },
  40: { text: '退款成功', color: 'green' },
  90: { text: '已拒绝', color: 'red' },
};

export const REFUND_STATUS_OPTIONS = Object.entries(REFUND_STATUS).map(([value, v]) => ({
  value: Number(value),
  label: v.text,
}));

export interface ListRefundParams extends PageQuery {
  status?: number;
}

export const listRefunds = (params: ListRefundParams) =>
  request.get<{ code: number; data: PageResult<RefundRow>; message: string }>('/admin/refunds', {
    params,
  });

export const getRefund = (id: number) =>
  request.get<{ code: number; data: RefundDetail; message: string }>(`/admin/refunds/${id}`);

export const reviewRefund = (id: number, data: { approve: boolean; rejectReason?: string }) =>
  request.post(`/admin/refunds/${id}/review`, data);

export const confirmReceiptRefund = (id: number) =>
  request.post(`/admin/refunds/${id}/confirm-receipt`);
