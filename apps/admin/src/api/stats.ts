import request from './request';

export interface OrderStatusStat {
  status: number;
  count: number;
}

export interface TrendPoint {
  date: string;
  orderCount: number;
  salesAmount: number;
}

export interface HotProduct {
  productId: number;
  productName: string;
  quantity: number;
  amount: number;
}

export interface Overview {
  totalUsers: number;
  totalProducts: number;
  todayUsers: number;
  todayProducts: number;
  totalOrders: number;
  totalSales: number;
  todayOrders: number;
  todaySales: number;
  orderStatus: OrderStatusStat[];
  salesTrend: TrendPoint[];
  hotProducts: HotProduct[];
}

export const getOverview = () =>
  request.get<{ code: number; data: Overview; message: string }>('/admin/stats/overview');
