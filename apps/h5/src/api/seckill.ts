import type { ApiResponse } from '@mall/shared';
import request from './request';

export interface SeckillProduct {
  skuId: number;
  productId: number;
  productName: string;
  productImage: string;
  skuSpec: string;
  seckillPrice: number; // 分
  originalPrice: number; // 分（现价，作为划线价展示）
  remainingStock: number;
  status: 'ongoing' | 'sold_out';
}

export interface SeckillActivity {
  activityId: number;
  name: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'ongoing';
  products: SeckillProduct[];
}

export interface GrabResult {
  status: 'pending' | 'grabbed' | 'sold_out' | 'unavailable';
  requestId?: string;
  orderId?: number;
  message?: string;
}

export interface SeckillResult {
  status: 'pending' | 'success' | 'fail';
  orderId?: number;
  message?: string;
}

export const getSeckillActivities = () =>
  request.get<ApiResponse<SeckillActivity[]>>('/seckill/activities');

export const grabSeckill = (activityId: number, skuId: number) =>
  request.post<ApiResponse<GrabResult>>('/seckill/grab', { activityId, skuId });

export const getSeckillResult = (requestId: string) =>
  request.get<ApiResponse<SeckillResult>>('/seckill/result', { params: { requestId } });
