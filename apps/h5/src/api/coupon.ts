import type { ApiResponse } from '@mall/shared';
import request from './request';

// ==================== 类型 ====================
export interface Coupon {
  id: number;
  name: string;
  type: number; // 1=满减 2=折扣
  thresholdAmount: number; // 分，0=无门槛
  discountAmount: number; // 分，满减用
  discountRate: number; // 如 85=8.5 折，折扣用
  totalStock: number;
  receivedCount: number;
  perUserLimit: number; // 0=不限
  startTime: string;
  endTime: string;
  status: number;
  description: string | null;
}

export interface MyCoupon {
  id: number;
  status: number; // 1=未使用 2=已使用
  receivedAt: string;
  usedAt: string | null;
  expired: boolean; // 未使用且已过有效期
  coupon: Coupon;
}

// ==================== 接口 ====================
export const listCoupons = () => request.get<ApiResponse<Coupon[]>>('/coupons');
export const receiveCoupon = (id: number) =>
  request.post<ApiResponse<MyCoupon>>(`/coupons/${id}/receive`);
export const listMyCoupons = () => request.get<ApiResponse<MyCoupon[]>>('/coupons/mine');

// ==================== 展示工具 ====================
const shortYuan = (fen: number): string => {
  const yuan = fen / 100;
  return Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(1);
};

/** 券面值文案：满减 → "¥20"；折扣 → "8.5折" */
export function couponFaceValue(c: Coupon): string {
  if (c.type === 1) return `¥${shortYuan(c.discountAmount)}`;
  return `${(c.discountRate / 10).toFixed(1).replace(/\.0$/, '')}折`;
}

/** 门槛文案：满减/折扣 → "满¥100可用" / "无门槛" */
export function couponThreshold(c: Coupon): string {
  if (c.thresholdAmount <= 0) return '无门槛';
  return `满¥${shortYuan(c.thresholdAmount)}可用`;
}

/** 优惠金额（分）：满减直接减；折扣按 round(总额×折扣率/100) 后的差额 */
export function computeDiscount(c: Coupon, totalAmount: number): number {
  if (c.type === 1) return c.discountAmount;
  return totalAmount - Math.round((totalAmount * c.discountRate) / 100);
}

export const formatDate = (iso: string): string => iso.slice(0, 10);
