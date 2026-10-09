import request from './request';
import type { PageQuery, PageResult } from './system';

export interface SeckillActivityRow {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  status: number; // 1=启用 0=停用
  skuCount: number;
  createdAt: string;
}

export interface SeckillSkuRow {
  id: number;
  activityId: number;
  skuId: number;
  seckillPrice: number; // 分
  seckillStock: number;
  sku: {
    id: number;
    price: number; // 现价（分）
    stock: number; // 物理库存
    image: string | null;
    product: { id: number; name: string; mainImage: string };
    specValues: { specValue: { value: string; group: { name: string } } }[];
  };
}

export interface SeckillActivityDetail {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  status: number;
  skus: SeckillSkuRow[];
}

export interface SkuOption {
  skuId: number;
  price: number; // 分
  stock: number;
  label: string;
}

export interface ListSeckillParams extends PageQuery {
  status?: number;
}

export interface SeckillActivityPayload {
  name: string;
  startTime: string;
  endTime: string;
  status?: number;
}

export interface SeckillSkuPayload {
  skuId: number;
  seckillPrice: number;
  seckillStock: number;
}

export const listSeckillActivities = (params: ListSeckillParams) =>
  request.get<{ code: number; data: PageResult<SeckillActivityRow>; message: string }>(
    '/admin/seckill/activities',
    { params },
  );

export const getSeckillActivity = (id: number) =>
  request.get<{ code: number; data: SeckillActivityDetail; message: string }>(
    `/admin/seckill/activities/${id}`,
  );

export const getSkuOptions = () =>
  request.get<{ code: number; data: SkuOption[]; message: string }>('/admin/seckill/sku-options');

export const createSeckillActivity = (data: SeckillActivityPayload) =>
  request.post('/admin/seckill/activities', data);

export const updateSeckillActivity = (id: number, data: Partial<SeckillActivityPayload>) =>
  request.patch(`/admin/seckill/activities/${id}`, data);

export const deleteSeckillActivity = (id: number) =>
  request.delete(`/admin/seckill/activities/${id}`);

export const addSeckillSku = (activityId: number, data: SeckillSkuPayload) =>
  request.post(`/admin/seckill/activities/${activityId}/skus`, data);

export const updateSeckillSku = (
  activityId: number,
  skuId: number,
  data: { seckillPrice?: number; seckillStock?: number },
) => request.patch(`/admin/seckill/activities/${activityId}/skus/${skuId}`, data);

export const deleteSeckillSku = (activityId: number, skuId: number) =>
  request.delete(`/admin/seckill/activities/${activityId}/skus/${skuId}`);
