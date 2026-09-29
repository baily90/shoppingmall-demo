import axios from 'axios';

// 商城端统一 axios 实例（阶段 3 购物车/下单再加用户 token 注入）
const request = axios.create({ baseURL: '/api', timeout: 10000 });

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? error.message ?? '请求失败';
  }
  return '请求失败';
}

export default request;
