import request from './request';
import type { PageQuery, PageResult } from './system';

// ==================== 分类 ====================
export interface CategoryNode {
  id: number;
  parentId: number | null;
  name: string;
  level: number;
  sort: number;
  status: number;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  children: CategoryNode[];
}

export interface CategoryPayload {
  name: string;
  parentId?: number | null;
  icon?: string;
  sort?: number;
  status?: number;
}

export const listCategories = () =>
  request.get<{ code: number; data: CategoryNode[]; message: string }>('/admin/categories');
export const createCategory = (data: CategoryPayload) => request.post('/admin/categories', data);
export const updateCategory = (id: number, data: CategoryPayload) =>
  request.patch(`/admin/categories/${id}`, data);
export const deleteCategory = (id: number) => request.delete(`/admin/categories/${id}`);

// ==================== 品牌 ====================
export interface BrandRow {
  id: number;
  name: string;
  logo: string | null;
  sort: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrandPayload {
  name: string;
  logo?: string;
  sort?: number;
  status?: number;
}

export const listBrands = (params: PageQuery) =>
  request.get<{ code: number; data: PageResult<BrandRow>; message: string }>('/admin/brands', {
    params,
  });
export const createBrand = (data: BrandPayload) => request.post('/admin/brands', data);
export const updateBrand = (id: number, data: BrandPayload) =>
  request.patch(`/admin/brands/${id}`, data);
export const deleteBrand = (id: number) => request.delete(`/admin/brands/${id}`);

// ==================== 商品 ====================
export interface ProductRow {
  id: number;
  name: string;
  subTitle: string | null;
  categoryId: number;
  brandId: number;
  mainImage: string;
  status: number;
  sort: number;
  createdAt: string;
  category: { id: number; name: string };
  brand: { id: number; name: string };
  _count: { skus: number };
}

export interface SkuSpecValue {
  id: number;
  value: string;
  groupId: number;
  groupName: string;
}

export interface SkuRow {
  id: number;
  price: number;
  originalPrice: number | null;
  stock: number;
  skuCode: string | null;
  image: string | null;
  status: number;
  specValues: SkuSpecValue[];
}

export interface SpecGroup {
  id: number;
  name: string;
  sort: number;
  values: { id: number; value: string; sort: number }[];
}

export interface ProductDetail extends ProductRow {
  subTitle: string | null;
  detail: string | null;
  deletedAt: string | null;
  images: { id: number; url: string; sort: number }[];
  specGroups: SpecGroup[];
  skus: SkuRow[];
}

export interface ListProductParams extends PageQuery {
  categoryId?: number;
  brandId?: number;
  status?: number;
}

export interface CreateProductPayload {
  name: string;
  subTitle?: string;
  categoryId: number;
  brandId: number;
  mainImage: string;
  detail?: string;
  status?: number;
  sort?: number;
  images?: string[];
  specGroups?: { name: string; values: string[] }[];
}

export interface UpdateSkuPayload {
  price?: number;
  originalPrice?: number | null;
  stock?: number;
  skuCode?: string | null;
  image?: string;
  status?: number;
}

export interface BatchUpdateSkuItem extends UpdateSkuPayload {
  id: number;
}

export const listProducts = (params: ListProductParams) =>
  request.get<{ code: number; data: PageResult<ProductRow>; message: string }>('/admin/products', {
    params,
  });
export const getProduct = (id: number) =>
  request.get<{ code: number; data: ProductDetail; message: string }>(`/admin/products/${id}`);
export const createProduct = (data: CreateProductPayload) => request.post('/admin/products', data);
export const updateProduct = (id: number, data: Partial<CreateProductPayload>) =>
  request.patch(`/admin/products/${id}`, data);
export const deleteProduct = (id: number) => request.delete(`/admin/products/${id}`);
export const updateSku = (skuId: number, data: UpdateSkuPayload) =>
  request.patch(`/admin/products/skus/${skuId}`, data);
export const updateSkus = (skus: BatchUpdateSkuItem[]) =>
  request.patch('/admin/products/skus', { skus });

// ==================== 图片上传 ====================
export const uploadImage = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post<{ code: number; data: { url: string; key: string }; message: string }>(
    '/admin/uploads/image',
    formData,
  );
};
