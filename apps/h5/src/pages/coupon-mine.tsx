import { useEffect, useMemo, useState } from 'react';
import { NavBar, Tabs, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { listMyCoupons } from '../api/coupon';
import type { MyCoupon } from '../api/coupon';
import { getErrorMessage } from '../api/request';
import CouponCard from '../components/CouponCard';

export default function CouponMine() {
  const navigate = useNavigate();
  const [list, setList] = useState<MyCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyCoupons()
      .then((res) => setList(res.data.data))
      .catch((e) => Toast.show({ content: getErrorMessage(e), icon: 'fail' }))
      .finally(() => setLoading(false));
  }, []);

  const unused = useMemo(() => list.filter((c) => c.status === 1 && !c.expired), [list]);
  const used = useMemo(() => list.filter((c) => c.status === 2), [list]);
  const expired = useMemo(() => list.filter((c) => c.status === 1 && c.expired), [list]);

  const renderList = (items: MyCoupon[]) => {
    if (loading) return <div className="empty">加载中…</div>;
    if (items.length === 0) return <div className="empty">暂无优惠券</div>;
    return (
      <div className="coupon-list">
        {items.map((c) => (
          <CouponCard key={c.id} coupon={c.coupon} disabled={c.status === 2 || c.expired}>
            {c.status === 2 ? (
              <span className="coupon-got">已使用</span>
            ) : c.expired ? (
              <span className="coupon-got">已过期</span>
            ) : null}
          </CouponCard>
        ))}
      </div>
    );
  };

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>我的券</NavBar>
      <Tabs>
        <Tabs.Tab title={`未使用(${unused.length})`} key="unused">
          {renderList(unused)}
        </Tabs.Tab>
        <Tabs.Tab title={`已使用(${used.length})`} key="used">
          {renderList(used)}
        </Tabs.Tab>
        <Tabs.Tab title={`已过期(${expired.length})`} key="expired">
          {renderList(expired)}
        </Tabs.Tab>
      </Tabs>
    </div>
  );
}
