import type { ApiResponse } from '@mall/shared';
import request from './request';

// ==================== 地址 ====================
export interface Address {
  id: number;
  userId: number;
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: number;
}

export interface AddressPayload {
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault?: number;
}

export const listAddresses = () => request.get<ApiResponse<Address[]>>('/addresses');
export const createAddress = (data: AddressPayload) =>
  request.post<ApiResponse<Address>>('/addresses', data);
export const updateAddress = (id: number, data: Partial<AddressPayload>) =>
  request.patch<ApiResponse<Address>>(`/addresses/${id}`, data);
export const deleteAddress = (id: number) => request.delete(`/addresses/${id}`);

// ==================== 购物车 ====================
export interface CartItem {
  id: number;
  skuId: number;
  productId: number;
  name: string;
  image: string;
  spec: string;
  price: number;
  stock: number;
  quantity: number;
  selected: number;
  onSale: boolean;
}

export const listCart = () => request.get<ApiResponse<CartItem[]>>('/cart');
export const addToCart = (skuId: number, quantity = 1) =>
  request.post('/cart', { skuId, quantity });
export const updateCartItem = (id: number, data: { quantity?: number; selected?: number }) =>
  request.patch(`/cart/${id}`, data);
export const removeCartItem = (id: number) => request.delete(`/cart/${id}`);

// ==================== 订单 ====================
export interface OrderSummary {
  id: number;
  orderNo: string;
  status: number;
  totalAmount: number;
  payAmount: number;
  itemCount: number;
  firstImage: string | null;
  firstName: string;
  createdAt: string;
  payExpireAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  skuId: number;
  productId: number;
  productName: string;
  skuSpec: string;
  productImage: string | null;
  price: number;
  quantity: number;
  totalAmount: number;
}

export interface OrderDetail {
  id: number;
  orderNo: string;
  userId: number;
  totalAmount: number;
  freightAmount: number;
  payAmount: number;
  status: number;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  remark: string | null;
  logisticsCompany: string | null;
  logisticsNo: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  payExpireAt: string;
  items: OrderItem[];
}

export interface CreateOrderPayload {
  addressId: number;
  items: { skuId: number; quantity: number }[];
  remark?: string;
  couponId?: number;
  idempotencyKey?: string;
}

export const createOrder = (data: CreateOrderPayload) =>
  request.post<ApiResponse<{ id: number; orderNo: string }>>('/orders', data);
export const listOrders = (params: { page?: number; pageSize?: number; status?: number }) =>
  request.get<ApiResponse<{ list: OrderSummary[]; total: number; page: number; pageSize: number }>>(
    '/orders',
    { params },
  );
export const getOrder = (id: number) => request.get<ApiResponse<OrderDetail>>(`/orders/${id}`);
export const payOrder = (id: number) => request.post(`/orders/${id}/pay`);
export const cancelOrder = (id: number) => request.post(`/orders/${id}/cancel`);
export const confirmOrder = (id: number) => request.post(`/orders/${id}/confirm`);

export interface OrderCounts {
  total: number;
  statusCounts: Record<string, number>;
}
export const getOrderCounts = () => request.get<ApiResponse<OrderCounts>>('/orders/counts');

// ==================== 订单状态 ====================
export const OrderStatus = {
  PENDING_PAYMENT: 10,
  PAID: 20,
  SHIPPED: 30,
  COMPLETED: 40,
  CANCELED: 50,
} as const;

export const ORDER_STATUS_TEXT: Record<number, string> = {
  10: '待支付',
  20: '待发货',
  30: '待收货',
  40: '已完成',
  50: '已取消',
};
