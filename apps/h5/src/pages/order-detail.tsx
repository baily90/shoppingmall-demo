import { useEffect, useState } from 'react';
import { Button, NavBar, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { cancelOrder, confirmOrder, getOrder, ORDER_STATUS_TEXT, payOrder } from '../api/trade';
import type { OrderDetail } from '../api/trade';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';

export default function OrderDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);

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
