import { useEffect, useState } from 'react';
import { NavBar, Tabs, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { listOrders, ORDER_STATUS_TEXT } from '../api/trade';
import type { OrderSummary } from '../api/trade';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';

const TABS = [
  { key: 'all', title: '全部' },
  { key: '10', title: '待支付' },
  { key: '20', title: '待发货' },
  { key: '30', title: '待收货' },
  { key: '40', title: '已完成' },
  { key: '50', title: '已取消' },
];

export default function Orders() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [list, setList] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      try {
        const res = await listOrders({
          page: 1,
          pageSize: 50,
          status: tab === 'all' ? undefined : Number(tab),
        });
        setList(res.data.data.list);
      } catch (e) {
        Toast.show({ content: getErrorMessage(e), icon: 'fail' });
      } finally {
        setLoading(false);
      }
    })();
  }, [tab]);

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>我的订单</NavBar>
      <Tabs activeKey={tab} onChange={setTab}>
        {TABS.map((t) => (
          <Tabs.Tab title={t.title} key={t.key} />
        ))}
      </Tabs>
      {loading ? (
        <div className="empty">加载中…</div>
      ) : list.length === 0 ? (
        <div className="empty">暂无订单</div>
      ) : (
        <div className="order-list">
          {list.map((o) => (
            <div key={o.id} className="order-card" onClick={() => navigate(`/order/${o.id}`)}>
              <div className="order-head">
                <span>{o.orderNo}</span>
                <span className="order-status">{ORDER_STATUS_TEXT[o.status]}</span>
              </div>
              <div className="order-body">
                {o.firstImage && <img className="order-img" src={o.firstImage} alt="" />}
                <div className="order-meta">
                  <div className="cart-name">
                    {o.firstName}
                    {o.itemCount > 1 ? ` 等 ${o.itemCount} 件` : ''}
                  </div>
                  <div className="order-time">{o.createdAt.slice(0, 19).replace('T', ' ')}</div>
                </div>
              </div>
              <div className="order-foot">
                <span>共 {o.itemCount} 件</span>
                <span>
                  实付 <span className="price">{formatPrice(o.payAmount)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
