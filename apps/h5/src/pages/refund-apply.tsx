import { useEffect, useState } from 'react';
import { Button, NavBar, Selector, TextArea, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { getOrder } from '../api/trade';
import type { OrderDetail } from '../api/trade';
import { applyRefund, REFUND_TYPE_TEXT } from '../api/refund';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';

const REASONS = ['不想要了', '商品质量问题', '商品与描述不符', '发错货', '其他'];

export default function RefundApply() {
  const navigate = useNavigate();
  const { id } = useParams();
  const orderId = Number(id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [reason, setReason] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getOrder(orderId);
        setOrder(res.data.data);
      } catch (e) {
        Toast.show({ content: getErrorMessage(e), icon: 'fail' });
      }
    })();
  }, [orderId]);

  // 30（已发货）→ 退货退款，20（已支付未发货）→ 仅退款
  const type = order?.status === 30 ? 2 : 1;

  const submit = async () => {
    if (!reason.length) {
      Toast.show({ content: '请选择申请原因', icon: 'fail' });
      return;
    }
    setLoading(true);
    try {
      await applyRefund({ orderId, reason: reason[0], description: description || undefined });
      Toast.show({ content: '申请已提交', icon: 'success' });
      navigate(`/order/${orderId}`, { replace: true });
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>申请售后</NavBar>
      {order && (
        <>
          <div className="od-card">
            <div className="od-row">
              <span>售后类型：</span>
              {REFUND_TYPE_TEXT[type]}
            </div>
            <div className="od-row">
              <span>退款金额：</span>
              <span className="price">{formatPrice(order.payAmount)}</span>
            </div>
            <div className="od-row">
              <span>订单号：</span>
              {order.orderNo}
            </div>
          </div>

          <div className="od-card">
            <div className="od-row">
              <span>申请原因</span>
            </div>
            <Selector
              columns={2}
              options={REASONS.map((r) => ({ label: r, value: r }))}
              value={reason}
              onChange={(v) => setReason(v as string[])}
            />
            <div style={{ marginTop: 12 }}>
              <TextArea
                placeholder="补充说明（选填）"
                value={description}
                onChange={setDescription}
                maxLength={500}
                rows={3}
              />
            </div>
          </div>

          <div className="od-actions">
            <Button
              block
              color="primary"
              size="large"
              loading={loading}
              onClick={() => void submit()}
            >
              提交申请
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
