import type { ApiResponse } from '@mall/shared';
import request from './request';

// ==================== 类型 ====================

/** 收藏夹列表项（含商品卡片信息） */
export interface FavoriteItem {
  id: number;
  productId: number;
  /** 最低在售 SKU 价（分），商品无在售 SKU 时为 null */
  price: number | null;
  product: {
    id: number;
    name: string;
    mainImage: string;
    status: number;
    /** 软删除标记（前端标「已失效」） */
    deleted: boolean;
  };
  createdAt: string;
}

// ==================== 接口 ====================

export const addFavorite = (productId: number) =>
  request.post<ApiResponse<{ favorited: boolean }>>(`/favorites/${productId}`);

export const removeFavorite = (productId: number) =>
  request.delete<ApiResponse<{ favorited: boolean }>>(`/favorites/${productId}`);

export const listFavorites = (params: { page?: number; pageSize?: number }) =>
  request.get<ApiResponse<{ list: FavoriteItem[]; total: number; page: number; pageSize: number }>>(
    '/favorites',
    { params },
  );

export const getFavoriteStatus = (productId: number) =>
  request.get<ApiResponse<{ favorited: boolean }>>(`/favorites/status/${productId}`);
