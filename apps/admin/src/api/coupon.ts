import request from './request';
import type { PageQuery, PageResult } from './system';

export interface CouponRow {
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
  status: number; // 1=启用 0=停用
  description: string | null;
  createdAt: string;
}

export interface ListCouponParams extends PageQuery {
  status?: number;
}

export interface CouponPayload {
  name: string;
  type: number;
  thresholdAmount?: number;
  discountAmount?: number;
  discountRate?: number;
  totalStock?: number;
  perUserLimit?: number;
  startTime: string;
  endTime: string;
  status?: number;
  description?: string;
}

export const COUPON_TYPE: Record<number, string> = {
  1: '满减',
  2: '折扣',
};

export const COUPON_STATUS: Record<number, { text: string; color: string }> = {
  1: { text: '启用', color: 'green' },
  0: { text: '停用', color: 'default' },
};

export const listCoupons = (params: ListCouponParams) =>
  request.get<{ code: number; data: PageResult<CouponRow>; message: string }>('/admin/coupons', {
    params,
  });

export const createCoupon = (data: CouponPayload) =>
  request.post<{ code: number; data: CouponRow; message: string }>('/admin/coupons', data);

export const updateCoupon = (id: number, data: Partial<CouponPayload>) =>
  request.patch(`/admin/coupons/${id}`, data);

export const deleteCoupon = (id: number) => request.delete(`/admin/coupons/${id}`);
