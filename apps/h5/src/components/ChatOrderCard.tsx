import { useState } from 'react';
import { Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { cancelOrder, confirmOrder, payOrder } from '../api/trade';
import { getErrorMessage } from '../api/request';
import Img from './Img';

// 客服工具返回的订单结构化数据（getOrder 输出）
export interface ChatOrder {
  id: number;
  orderNo: string;
  status: number; // 原始状态码：10 待支付 / 20 待发货 / 30 待收货 / 40 已完成
  statusText: string;
  payAmount?: string | null; // 展示用（元）
  itemCount?: number;
  productName?: string;
  image?: string | null;
  createdAt?: string;
}

/**
 * 聊天里的订单卡片：按订单状态显示操作（支付/取消/确认收货/退款/评价），
 * 点击卡片进订单详情。操作复用 api/trade 的现有接口。
 */
export default function ChatOrderCard({ order }: { order: ChatOrder }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // 执行一个订单操作，成功后跳订单详情页查看最新状态
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      Toast.show({ content: msg, icon: 'success' });
      navigate(`/order/${order.id}`);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setBusy(false);
    }
  };

  const goDetail = () => navigate(`/order/${order.id}`);

  // 按状态生成操作按钮
  const actions = (() => {
    switch (order.status) {
      case 10:
        return (
          <>
            <button
              className="chat-order-btn primary"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void act(() => payOrder(order.id), '支付成功');
              }}
            >
              去支付
            </button>
            <button
              className="chat-order-btn"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void act(() => cancelOrder(order.id), '已取消');
              }}
            >
              取消订单
            </button>
          </>
        );
      case 20:
        return (
          <button
            className="chat-order-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/order/${order.id}/refund`);
            }}
          >
            申请退款
          </button>
        );
      case 30:
        return (
          <>
            <button
              className="chat-order-btn primary"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void act(() => confirmOrder(order.id), '已确认收货');
              }}
            >
              确认收货
            </button>
            <button
              className="chat-order-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/order/${order.id}/refund`);
              }}
            >
              申请退货退款
            </button>
          </>
        );
      case 40:
        return (
          <button
            className="chat-order-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/order/${order.id}/review`);
            }}
          >
            评价
          </button>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="chat-order-card" onClick={goDetail}>
      <div className="chat-order-head">
        <span className={`chat-order-status s${order.status}`}>{order.statusText}</span>
        <span className="chat-order-no">{order.orderNo}</span>
      </div>
      <div className="chat-order-body">
        <Img className="chat-order-img" src={order.image} alt={order.productName ?? ''} />
        <div className="chat-order-info">
          <div className="chat-order-name">{order.productName}</div>
          <div className="chat-order-meta">共 {order.itemCount ?? 1} 件</div>
          {order.payAmount != null && (
            <div className="price chat-order-price">{order.payAmount}</div>
          )}
        </div>
      </div>
      {actions && <div className="chat-order-actions">{actions}</div>}
    </div>
  );
}
