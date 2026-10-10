import request from './request';
import type { PageQuery, PageResult } from './system';

export interface HomeSlotRow {
  id: number;
  type: number; // 1=轮播图 2=金刚区图标
  name: string;
  image: string;
  linkType: number; // 0 无 1 商品 2 分类 3 秒杀 4 外链
  linkValue: string | null;
  sort: number;
  status: number; // 1=启用 0=停用
  createdAt: string;
  updatedAt: string;
}

export interface ListHomeSlotParams extends PageQuery {
  type: number;
  status?: number;
}

export interface HomeSlotPayload {
  type: number;
  name: string;
  image: string;
  linkType?: number;
  linkValue?: string;
  sort?: number;
  status?: number;
}

export const HOME_SLOT_TYPE: Record<number, string> = {
  1: '轮播图',
  2: '金刚区图标',
};

export const HOME_LINK_TYPE: Record<number, string> = {
  0: '无跳转',
  1: '商品',
  2: '分类',
  3: '秒杀',
  4: '外链',
};

export const HOME_SLOT_STATUS: Record<number, { text: string; color: string }> = {
  1: { text: '启用', color: 'green' },
  0: { text: '停用', color: 'default' },
};

export const listHomeSlots = (params: ListHomeSlotParams) =>
  request.get<{ code: number; data: PageResult<HomeSlotRow>; message: string }>('/admin/home', {
    params,
  });

export const createHomeSlot = (data: HomeSlotPayload) =>
  request.post<{ code: number; data: HomeSlotRow; message: string }>('/admin/home', data);

export const updateHomeSlot = (id: number, data: Partial<HomeSlotPayload>) =>
  request.patch(`/admin/home/${id}`, data);

export const deleteHomeSlot = (id: number) => request.delete(`/admin/home/${id}`);
