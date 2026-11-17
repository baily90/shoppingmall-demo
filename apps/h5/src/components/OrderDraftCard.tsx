import { useState } from 'react';
import { Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { createOrder } from '../api/trade';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';
import Img from './Img';

// 客服 createOrderDraft 工具输出的订单草稿（金额单位：分）
export interface OrderDraft {
  items: Array<{
    skuId: number;
    quantity: number;
    name: string;
    price: number; // 分
    image?: string | null;
    subtotal?: number; // 分
  }>;
  address: { id: number; receiverName: string; receiverPhone: string; fullAddress: string };
  totalAmount: number; // 分
  itemCount: number;
}

/**
 * 订单确认卡片：展示 agent 生成的订单草稿，用户点「确认下单」才真正调 createOrder。
 * 这是 human-in-the-loop：agent 不直接下单，由用户在前端确认。
 */
export default function OrderDraftCard({ draft }: { draft: OrderDraft }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);

  const confirm = async () => {
    if (submitting || placed) return;
    setSubmitting(true);
    try {
      const res = await createOrder({
        addressId: draft.address.id,
        items: draft.items.map((it) => ({ skuId: it.skuId, quantity: it.quantity })),
      });
      setPlaced(true);
      Toast.show({ content: '下单成功', icon: 'success' });
      navigate(`/order/${res.data.data.id}`);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="chat-order-draft">
      <div className="chat-draft-title">订单确认</div>

      {draft.items.map((it) => (
        <div key={it.skuId} className="chat-draft-item">
          <Img className="chat-draft-img" src={it.image} alt={it.name} />
          <div className="chat-draft-info">
            <div className="chat-draft-name">{it.name}</div>
            <div className="chat-draft-price">
              {formatPrice(it.price)} × {it.quantity}
            </div>
          </div>
        </div>
      ))}

      <div className="chat-draft-addr">
        <div className="chat-draft-addr-label">收货地址</div>
        <div>
          {draft.address.receiverName} {draft.address.receiverPhone}
          <br />
          {draft.address.fullAddress}
        </div>
      </div>

      <div className="chat-draft-total">
        共 {draft.itemCount} 件，合计{' '}
        <span className="price">{formatPrice(draft.totalAmount)}</span>
      </div>

      {placed ? (
        <div className="chat-draft-placed">✅ 已下单成功</div>
      ) : (
        <button className="chat-draft-confirm" disabled={submitting} onClick={() => void confirm()}>
          {submitting ? '下单中…' : '确认下单'}
        </button>
      )}
    </div>
  );
}
