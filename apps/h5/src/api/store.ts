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

// ==================== 品牌 ====================
export interface BrandRow {
  id: number;
  name: string;
  logo: string | null;
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

export const listBrands = (params: { categoryId?: number; pageSize?: number }) =>
  request.get<ApiResponse<{ list: BrandRow[]; total: number; page: number; pageSize: number }>>(
    '/brands',
    { params },
  );

export const listProducts = (params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  brandId?: number;
}) => request.get<ApiResponse<StoreProductList>>('/products', { params });

export const getProduct = (id: number) =>
  request.get<ApiResponse<ProductDetail>>(`/products/${id}`);
