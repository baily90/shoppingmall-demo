import { Home, ShoppingCart, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCartCount } from '../store/cart';

const tabs: { key: string; title: string; icon: LucideIcon }[] = [
  { key: '/', title: '首页', icon: Home },
  { key: '/cart', title: '购物车', icon: ShoppingCart },
  { key: '/mine', title: '我的', icon: User },
];

/** 底部导航栏：首页 / 购物车 / 我的（仅在带 tab 的页面展示） */
export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { count } = useCartCount();
  const activeKey = tabs.find((t) => t.key === location.pathname)?.key ?? '/';

  return (
    <div className="tab-bar">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.key === activeKey;
        return (
          <div
            key={t.key}
            className={`tab-item${active ? ' active' : ''}`}
            onClick={() => navigate(t.key)}
          >
            <div className="tab-item-icon">
              <Icon size={22} strokeWidth={active ? 2.1 : 1.75} />
              {t.key === '/cart' && count > 0 && (
                <span className="tab-badge">{count > 99 ? '99+' : count}</span>
              )}
            </div>
            <span className="tab-item-title">{t.title}</span>
          </div>
        );
      })}
    </div>
  );
}
