import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Badge, Button, Dialog, List, NavBar, Toast } from 'antd-mobile';
import { CircleCheck, ChevronRight, Package, RotateCcw, Truck, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { getOrderCounts } from '../api/trade';
import BottomTabBar from '../components/TabBar';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const ORDER_SHORTCUTS: { status: string; label: string; icon: LucideIcon }[] = [
  { status: '10', label: '待支付', icon: Wallet },
  { status: '20', label: '待发货', icon: Package },
  { status: '30', label: '待收货', icon: Truck },
  { status: 'aftersale', label: '退款/售后', icon: RotateCcw },
  { status: '40', label: '已完成', icon: CircleCheck },
];

export default function Mine() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getOrderCounts()
      .then((res) => setCounts(res.data.data.statusCounts))
      .catch(() => {});
  }, []);

  const doLogout = async () => {
    await logout();
    Toast.show({ content: '已退出登录', icon: 'success' });
    navigate('/');
  };

  const confirmLogout = () => {
    Dialog.confirm({
      content: '确认退出登录？',
      onConfirm: () => void doLogout(),
    });
  };

  return (
    <div className="page tab-page">
      <NavBar back={null}>我的</NavBar>
      <div className="mine-head">
        {user ? (
          <>
            <div className="mine-avatar">{user.nickname.slice(0, 1)}</div>
            <div>
              <div className="mine-name">{user.nickname}</div>
              <div className="mine-phone">{user.phone}</div>
            </div>
          </>
        ) : (
          <div className="mine-guest">
            <span>未登录</span>
            <Button size="small" color="primary" onClick={() => navigate('/login')}>
              去登录
            </Button>
          </div>
        )}
      </div>

      {/* 我的订单：全部订单入口 + 各状态平铺快捷入口（带数量角标） */}
      <div className="mine-orders">
        <div className="mine-orders-head" onClick={() => navigate('/orders')}>
          <span>我的订单</span>
          <span className="mine-orders-all">
            全部订单
            <ChevronRight size={15} strokeWidth={2} />
          </span>
        </div>
        <div className="mine-orders-grid">
          {ORDER_SHORTCUTS.map((s, i) => {
            const Icon = s.icon;
            const n = counts[s.status] ?? 0;
            return (
              <motion.div
                key={s.status}
                className="mine-order-item"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.4, ease: EASE }}
                whileTap={{ scale: 0.94 }}
                onClick={() => navigate(`/orders?status=${s.status}`)}
              >
                <Badge content={s.status !== '40' && n > 0 ? n : null}>
                  <span className="mine-order-icon">
                    <Icon size={24} strokeWidth={1.75} />
                  </span>
                </Badge>
                <span className="mine-order-label">{s.label}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <List className="mine-menu">
        <List.Item onClick={() => navigate('/coupons/mine')}>我的券</List.Item>
        <List.Item onClick={() => navigate('/reviews/mine')}>我的评价</List.Item>
        <List.Item onClick={() => navigate('/favorites')}>我的收藏</List.Item>
        <List.Item onClick={() => navigate('/address')}>地址管理</List.Item>
      </List>
      {user && (
        <div className="mine-logout">
          <Button block color="danger" onClick={confirmLogout}>
            退出登录
          </Button>
        </div>
      )}
      <BottomTabBar />
    </div>
  );
}
