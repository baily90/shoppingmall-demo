import type { NavigateFunction } from 'react-router-dom';

export interface BuyItem {
  skuId: number;
  quantity: number;
  name: string;
  image: string;
  spec: string;
  price: number; // 分
}

/**
 * 统一下单入口：商品详情页、聊天商品卡片等所有「立即购买」共用，
 * 保证进入 checkout 的 state 结构一致，避免多处复制导致行为漂移。
 */
export function goBuyNow(navigate: NavigateFunction, items: BuyItem[]) {
  navigate('/checkout', { state: { items } });
}
