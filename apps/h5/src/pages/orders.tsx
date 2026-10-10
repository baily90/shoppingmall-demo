import { useCallback, useEffect, useState } from 'react';
import { Button, NavBar, Tabs, Toast } from 'antd-mobile';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cancelOrder, confirmOrder, listOrders, ORDER_STATUS_TEXT, payOrder } from '../api/trade';
import type { OrderSummary } from '../api/trade';
import { ACTIVE_REFUND_STATUSES, REFUND_STATUS_TEXT } from '../api/refund';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';

const TABS = [
  { key: 'all', title: '全部' },
  { key: '10', title: '待支付' },
  { key: '20', title: '待发货' },
  { key: '30', title: '待收货' },
  { key: 'aftersale', title: '退款/售后' },
  { key: '40', title: '已完成' },
  { key: '50', title: '已取消' },
];

/** 订单是否有进行中的售后（展示层派生「售后中」，冻结确认收货等操作） */
const hasActiveRefund = (o: OrderSummary) =>
  !!o.refund && ACTIVE_REFUND_STATUSES.includes(o.refund.status);

/** 列表卡片状态文案：进行中售后优先显示售后子状态，否则显示订单状态 */
const orderStatusText = (o: OrderSummary) =>
  hasActiveRefund(o) ? REFUND_STATUS_TEXT[o.refund!.status] : ORDER_STATUS_TEXT[o.status];

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 支持从「我的」页角标入口进来时定位到对应状态 tab
  const [tab, setTab] = useState(searchParams.get('status') ?? 'all');
  const [list, setList] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; pageSize: number; status?: number; refundActive?: boolean } = {
        page: 1,
        pageSize: 50,
      };
      if (tab === 'aftersale') {
        // 退款/售后：只看有进行中售后的订单（订单状态可能是待发货/待收货）
        params.refundActive = true;
      } else if (tab === '20' || tab === '30') {
        // 待发货/待收货：排除售后中的订单，它们归属「退款/售后」tab
        params.status = Number(tab);
        params.refundActive = false;
      } else if (tab !== 'all') {
        params.status = Number(tab);
      }
      const res = await listOrders(params);
      setList(res.data.data.list);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  // 列表页直接操作（与订单详情页按钮行为保持一致），操作后刷新列表
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      Toast.show({ content: msg, icon: 'success' });
      await load();
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };

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
                <span className="order-status">{orderStatusText(o)}</span>
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
              {(o.status === 10 || o.status === 30) && (
                <div className="order-actions" onClick={(e) => e.stopPropagation()}>
                  {o.status === 10 && (
                    <>
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => void act(() => payOrder(o.id), '支付成功')}
                      >
                        去支付
                      </Button>
                      <Button
                        size="small"
                        onClick={() => void act(() => cancelOrder(o.id), '已取消')}
                      >
                        取消订单
                      </Button>
                    </>
                  )}
                  {o.status === 30 && !hasActiveRefund(o) && (
                    <Button
                      size="small"
                      color="primary"
                      onClick={() => void act(() => confirmOrder(o.id), '已确认收货')}
                    >
                      确认收货
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
