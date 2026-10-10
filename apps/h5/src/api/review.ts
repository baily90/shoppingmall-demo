import type { ApiResponse } from '@mall/shared';
import request from './request';

/** 订单项上挂的评价摘要（null 表示未评价） */
export interface OrderItemReview {
  id: number;
  rating: number;
  content: string | null;
  status: number;
  createdAt: string;
}

/** 商品评价列表项（公开） */
export interface ProductReviewItem {
  id: number;
  rating: number;
  content: string | null;
  images: string[];
  anonymous: boolean;
  nickname: string;
  avatar: string | null;
  skuSpec: string;
  /** 是否当前登录用户自己的评价（用于详情页置顶 + 「我的评价」标签） */
  mine: boolean;
  createdAt: string;
}

/** 我的评价列表项 */
export interface MyReviewItem {
  id: number;
  orderId: number;
  productId: number;
  rating: number;
  content: string | null;
  images: string[];
  anonymous: boolean;
  /** 1 正常展示 / 0 已屏蔽 */
  status: number;
  product: { id: number; name: string; mainImage: string };
  skuSpec: string;
  createdAt: string;
}

export interface CreateReviewPayload {
  orderId: number;
  orderItemId: number;
  rating: number;
  content?: string;
  images?: string[];
  anonymous?: boolean;
}

export const createReview = (data: CreateReviewPayload) =>
  request.post<ApiResponse<{ id: number }>>('/reviews', data);

export const listProductReviews = (
  productId: number,
  params: { page?: number; pageSize?: number },
) =>
  request.get<
    ApiResponse<{ list: ProductReviewItem[]; total: number; page: number; pageSize: number }>
  >(`/products/${productId}/reviews`, { params });

export const listMyReviews = (params: { page?: number; pageSize?: number }) =>
  request.get<ApiResponse<{ list: MyReviewItem[]; total: number; page: number; pageSize: number }>>(
    '/reviews/mine',
    { params },
  );

/** 上传评价图片：返回 { url, key } */
export const uploadImage = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post<ApiResponse<{ url: string; key: string }>>('/uploads/image', formData);
};
