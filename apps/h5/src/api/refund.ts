import type { ApiResponse } from '@mall/shared';
import request from './request';

export interface Refund {
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
  updatedAt: string;
}

export const RefundType = {
  REFUND_ONLY: 1,
  RETURN_REFUND: 2,
} as const;

export const REFUND_TYPE_TEXT: Record<number, string> = {
  1: '仅退款',
  2: '退货退款',
};

export const REFUND_STATUS_TEXT: Record<number, string> = {
  10: '待商家审核',
  20: '待买家退货',
  30: '待商家收货',
  40: '退款成功',
  90: '已拒绝',
};

export const applyRefund = (data: { orderId: number; reason: string; description?: string }) =>
  request.post<ApiResponse<Refund>>('/refunds', data);

export const shipBackRefund = (
  id: number,
  data: { logisticsCompany: string; logisticsNo: string },
) => request.post(`/refunds/${id}/ship-back`, data);
