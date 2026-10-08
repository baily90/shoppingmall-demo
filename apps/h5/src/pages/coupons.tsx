import { useEffect, useState } from 'react';
import { Button, NavBar, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { listCoupons, receiveCoupon } from '../api/coupon';
import type { Coupon } from '../api/coupon';
import { getErrorMessage } from '../api/request';
import { useAuth } from '../store/auth';
import CouponCard from '../components/CouponCard';

export default function Coupons() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [receivedIds, setReceivedIds] = useState<Set<number>>(new Set());
  const [receivingId, setReceivingId] = useState<number | null>(null);

  useEffect(() => {
    listCoupons()
      .then((res) => setCoupons(res.data.data))
      .catch((e) => Toast.show({ content: getErrorMessage(e), icon: 'fail' }))
      .finally(() => setLoading(false));
  }, []);

  const receive = async (id: number) => {
    if (!user) {
      Toast.show({ content: '请先登录', icon: 'fail' });
      navigate('/login');
      return;
    }
    setReceivingId(id);
    try {
      await receiveCoupon(id);
      setReceivedIds((prev) => new Set(prev).add(id));
      Toast.show({ content: '领取成功', icon: 'success' });
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setReceivingId(null);
    }
  };

  const now = Date.now();

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>领券中心</NavBar>
      {loading ? (
        <div className="empty">加载中…</div>
      ) : coupons.length === 0 ? (
        <div className="empty">暂无优惠券</div>
      ) : (
        <div className="coupon-list">
          {coupons.map((c) => {
            const received = receivedIds.has(c.id);
            const soldOut = c.receivedCount >= c.totalStock;
            const notStarted = new Date(c.startTime).getTime() > now;
            const canReceive = !received && !soldOut && !notStarted;
            return (
              <CouponCard key={c.id} coupon={c} disabled={received || soldOut || notStarted}>
                {received ? (
                  <span className="coupon-got">已领取</span>
                ) : soldOut ? (
                  <span className="coupon-got">已领完</span>
                ) : notStarted ? (
                  <span className="coupon-got">未开始</span>
                ) : (
                  <Button
                    size="small"
                    color="primary"
                    loading={receivingId === c.id}
                    onClick={() => void receive(c.id)}
                  >
                    领取
                  </Button>
                )}
              </CouponCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
