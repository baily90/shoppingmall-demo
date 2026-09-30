import { useEffect, useRef, useState } from 'react';
import { Button, NavBar, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { cancelOrder, confirmOrder, getOrder, ORDER_STATUS_TEXT, payOrder } from '../api/trade';
import type { OrderDetail } from '../api/trade';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function OrderDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = async () => {
    try {
      const res = await getOrder(Number(id));
      setOrder(res.data.data);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };
  useEffect(() => {
    void load();
  }, [id]);

  // 每秒 tick 一次，驱动「待支付」倒计时
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remainMs =
    order?.status === 10 && order.payExpireAt ? new Date(order.payExpireAt).getTime() - now : 0;

  // 倒计时归零时自动刷新一次，拉取后端「自动取消」后的最新状态（仅触发一次）
  const autoReloaded = useRef(false);
  useEffect(() => {
    if (!order || order.status !== 10) {
      autoReloaded.current = false;
      return;
    }
    if (remainMs <= 0 && !autoReloaded.current) {
      autoReloaded.current = true;
      void load();
    }
  }, [remainMs, order?.status]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      Toast.show({ content: msg, icon: 'success' });
      await load();
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };

  if (!order) {
    return (
      <div className="page">
        <NavBar onBack={() => navigate(-1)}>订单详情</NavBar>
        <div className="empty">加载中…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>订单详情</NavBar>
      <div className="od-status">{ORDER_STATUS_TEXT[order.status]}</div>
      {order.status === 10 && remainMs > 0 && (
        <div className="od-countdown">支付剩余 {formatCountdown(remainMs)}，超时自动取消</div>
      )}

      <div className="od-card">
        <div className="od-row">
          <span>收货人：</span>
          {order.receiverName} {order.receiverPhone}
        </div>
        <div className="od-row">
          <span>收货地址：</span>
          {order.receiverAddress}
        </div>
        <div className="od-row">
          <span>订单号：</span>
          {order.orderNo}
        </div>
        <div className="od-row">
          <span>下单时间：</span>
          {order.createdAt.slice(0, 19).replace('T', ' ')}
        </div>
        {order.remark && (
          <div className="od-row">
            <span>备注：</span>
            {order.remark}
          </div>
        )}
        {order.logisticsCompany && (
          <div className="od-row">
            <span>物流：</span>
            {order.logisticsCompany} {order.logisticsNo}
          </div>
        )}
      </div>

      <div className="od-card">
        {order.items.map((it) => (
          <div key={it.id} className="od-item">
            {it.productImage && <img className="order-img" src={it.productImage} alt="" />}
            <div className="od-item-meta">
              <div className="cart-name">{it.productName}</div>
              {it.skuSpec && <div className="cart-spec">{it.skuSpec}</div>}
              <div className="price">
                {formatPrice(it.price)} × {it.quantity}
              </div>
            </div>
          </div>
        ))}
        <div className="od-total">
          合计：<span className="price">{formatPrice(order.payAmount)}</span>
          {order.freightAmount > 0 && `（含运费 ${formatPrice(order.freightAmount)}）`}
        </div>
      </div>

      {(order.status === 10 || order.status === 30) && (
        <div className="od-actions">
          {order.status === 10 && (
            <>
              <Button
                color="primary"
                onClick={() => void act(() => payOrder(order.id), '支付成功')}
              >
                去支付
              </Button>
              <Button onClick={() => void act(() => cancelOrder(order.id), '已取消')}>
                取消订单
              </Button>
            </>
          )}
          {order.status === 30 && (
            <Button
              color="primary"
              onClick={() => void act(() => confirmOrder(order.id), '已确认收货')}
            >
              确认收货
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
