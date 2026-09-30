import { TabBar } from 'antd-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCartCount } from '../store/cart';

const tabs = [
  { key: '/', title: '首页', icon: '🏠' },
  { key: '/cart', title: '购物车', icon: '🛒' },
  { key: '/mine', title: '我的', icon: '👤' },
];

/** 底部导航栏：首页 / 购物车 / 我的（仅在带 tab 的页面展示） */
export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { count } = useCartCount();
  const activeKey = tabs.find((t) => t.key === location.pathname)?.key ?? '/';

  return (
    <div className="tab-bar">
      <TabBar activeKey={activeKey} onChange={(key) => navigate(key)}>
        {tabs.map((t) => (
          <TabBar.Item
            key={t.key}
            icon={<span className="tab-icon">{t.icon}</span>}
            title={t.title}
            badge={t.key === '/cart' && count > 0 ? count : undefined}
          />
        ))}
      </TabBar>
    </div>
  );
}
