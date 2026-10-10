import type { ApiResponse } from '@mall/shared';
import request from './request';

// ==================== 类型 ====================

/** 首页装修位（type 1=轮播图 2=金刚区图标，共用一套模型） */
export interface HomeSlot {
  id: number;
  type: number;
  name: string;
  image: string;
  /** 0 无跳转 1 商品 2 分类 3 秒杀 4 外链 */
  linkType: number;
  linkValue: string | null;
  sort: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface HomeSlots {
  banners: HomeSlot[];
  navIcons: HomeSlot[];
}

// ==================== 接口 ====================

/** 首页装修位（公开，服务端走 Redis 缓存） */
export const getHomeSlots = () => request.get<ApiResponse<HomeSlots>>('/home/slots');
