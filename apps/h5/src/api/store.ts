import type { ApiResponse } from '@mall/shared';
import request from './request';

// ==================== 分类 ====================
export interface CategoryNode {
  id: number;
  parentId: number | null;
  name: string;
  level: number;
  sort: number;
  status: number;
  icon: string | null;
  children: CategoryNode[];
}

export interface FlatCategory {
  id: number;
  name: string;
  level: number;
}

/** 把分类树拍平成一维数组（供横向筛选栏使用，level 用于缩进） */
export function flattenCategories(nodes: CategoryNode[]): FlatCategory[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, level: n.level },
    ...flattenCategories(n.children),
  ]);
}

// ==================== 商品列表 ====================
export interface StoreProductRow {
  id: number;
  name: string;
  subTitle: string | null;
  mainImage: string;
  price: number | null;
  originalPrice: number | null;
}

export interface StoreProductList {
  list: StoreProductRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== 商品详情 ====================
export interface SpecValue {
  id: number;
  value: string;
  sort: number;
}
export interface SpecGroup {
  id: number;
  name: string;
  sort: number;
  values: SpecValue[];
}
export interface SkuSpecValue {
  id: number;
  value: string;
  groupId: number;
  groupName: string;
}
export interface Sku {
  id: number;
  price: number;
  originalPrice: number | null;
  stock: number;
  skuCode: string | null;
  image: string | null;
  status: number;
  specValues: SkuSpecValue[];
}
export interface ProductDetail {
  id: number;
  name: string;
  subTitle: string | null;
  categoryId: number;
  brandId: number;
  mainImage: string;
  detail: string | null;
  status: number;
  images: { id: number; url: string; sort: number }[];
  specGroups: SpecGroup[];
  skus: Sku[];
}

export const listCategories = () => request.get<ApiResponse<CategoryNode[]>>('/categories');

export const listProducts = (params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
}) => request.get<ApiResponse<StoreProductList>>('/products', { params });

export const getProduct = (id: number) =>
  request.get<ApiResponse<ProductDetail>>(`/products/${id}`);
