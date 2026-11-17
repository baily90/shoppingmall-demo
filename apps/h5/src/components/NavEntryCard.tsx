import { useNavigate } from 'react-router-dom';

// 客服 navigateTo 工具输出的跳转入口
export interface NavEntry {
  target: 'address' | 'orders' | 'cart' | 'coupons' | 'favorites' | 'mine' | 'seckill';
  label: string;
  description?: string;
}

// target → 路由映射（前端统一维护，agent 传语义 target，不直接传路径，避免跳错）
const TARGET_PATH: Record<NavEntry['target'], string> = {
  address: '/address',
  orders: '/orders',
  cart: '/cart',
  coupons: '/coupons',
  favorites: '/favorites',
  mine: '/mine',
  seckill: '/seckill',
};

/** 可点击的跳转入口卡片：引导用户去地址管理、订单列表等页面 */
export default function NavEntryCard({ entry }: { entry: NavEntry }) {
  const navigate = useNavigate();
  const path = TARGET_PATH[entry.target] ?? '/';

  return (
    <button type="button" className="chat-nav-entry" onClick={() => navigate(path)}>
      <span className="chat-nav-entry-label">{entry.label}</span>
      {entry.description && <span className="chat-nav-entry-desc">{entry.description}</span>}
      <span className="chat-nav-entry-arrow">›</span>
    </button>
  );
}
