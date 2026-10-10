import request from './request';
import type { PageQuery, PageResult } from './system';

export interface ReviewRow {
  id: number;
  orderId: number;
  orderItemId: number;
  userId: number;
  productId: number;
  rating: number;
  content: string | null;
  images: string[] | null;
  anonymous: boolean;
  status: number;
  /** 商家回复（单条，可覆盖） */
  replyContent: string | null;
  replyAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: { id: number; name: string; mainImage: string };
  user: { id: number; nickname: string; phone: string };
  order: { id: number; orderNo: string };
}

/** 评价展示状态：1 正常 / 0 已屏蔽（先发后审，后台可屏蔽/恢复） */
export const REVIEW_STATUS: Record<number, { text: string; color: string }> = {
  1: { text: '正常', color: 'green' },
  0: { text: '已屏蔽', color: 'red' },
};

export const REVIEW_STATUS_OPTIONS = Object.entries(REVIEW_STATUS).map(([value, v]) => ({
  value: Number(value),
  label: v.text,
}));

export const REVIEW_RATING_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({
  value: n,
  label: `${n} 星`,
}));

export interface ListReviewParams extends PageQuery {
  status?: number;
  rating?: number;
  productId?: number;
}

export const listReviews = (params: ListReviewParams) =>
  request.get<{ code: number; data: PageResult<ReviewRow>; message: string }>('/admin/reviews', {
    params,
  });

export const setReviewStatus = (id: number, status: number) =>
  request.post(`/admin/reviews/${id}/status`, { status });

/** 商家回复评价（单条，可覆盖） */
export const replyReview = (id: number, content: string) =>
  request.post(`/admin/reviews/${id}/reply`, { content });
