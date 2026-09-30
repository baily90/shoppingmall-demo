import { useEffect, useMemo, useState } from 'react';
import { Button, List, NavBar, Popup, TextArea, Toast } from 'antd-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { createOrder, listAddresses } from '../api/trade';
import type { Address } from '../api/trade';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';
import { useCartCount } from '../store/cart';

interface CheckoutItem {
  skuId: number;
  quantity: number;
  name: string;
  image: string;
  spec: string;
  price: number;
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useCartCount();
  const items = (location.state?.items as CheckoutItem[]) ?? [];

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<number | undefined>();
  const [addrPopup, setAddrPopup] = useState(false);
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await listAddresses();
        const list = res.data.data;
        setAddresses(list);
        setSelectedAddrId(list.find((a) => a.isDefault === 1)?.id ?? list[0]?.id);
      } catch (e) {
        Toast.show({ content: getErrorMessage(e), icon: 'fail' });
      }
    })();
  }, []);

  const selectedAddr = addresses.find((a) => a.id === selectedAddrId);
  const totalPrice = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const totalCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const submit = async () => {
    if (!selectedAddrId) {
      Toast.show({ content: '请先选择收货地址', icon: 'fail' });
      setAddrPopup(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await createOrder({
        addressId: selectedAddrId,
        items: items.map((i) => ({ skuId: i.skuId, quantity: i.quantity })),
        remark: remark || undefined,
      });
      Toast.show({ content: '下单成功', icon: 'success' });
      navigate(`/order/${res.data.data.id}`, { replace: true });
      refresh();
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="page">
        <NavBar onBack={() => navigate(-1)}>确认订单</NavBar>
        <div className="empty">没有待结算的商品</div>
      </div>
    );
  }

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>确认订单</NavBar>

      {/* 收货地址 */}
      <div className="checkout-block checkout-addr" onClick={() => setAddrPopup(true)}>
        {selectedAddr ? (
          <>
            <div className="addr-line">
              <span className="addr-name">{selectedAddr.receiverName}</span>
              <span>{selectedAddr.receiverPhone}</span>
            </div>
            <div className="addr-detail">
              {selectedAddr.province}
              {selectedAddr.city}
              {selectedAddr.district}
              {selectedAddr.detail}
            </div>
          </>
        ) : (
          <div className="addr-empty">请选择收货地址</div>
        )}
        <span className="addr-arrow">›</span>
      </div>

      {/* 商品清单 */}
      <div className="checkout-block">
        <div className="checkout-title">商品清单</div>
        {items.map((it) => (
          <div key={it.skuId} className="checkout-item">
            <img className="cart-img" src={it.image} alt={it.name} />
            <div className="checkout-item-meta">
              <div className="cart-name">{it.name}</div>
              {it.spec && <div className="cart-spec">{it.spec}</div>}
              <div className="price">
                {formatPrice(it.price)} × {it.quantity}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 备注 */}
      <div className="checkout-block">
        <TextArea
          placeholder="订单备注（选填）"
          value={remark}
          onChange={setRemark}
          maxLength={200}
          rows={2}
        />
      </div>

      {/* 底部结算栏 */}
      <div className="checkout-footer">
        <div className="checkout-total">
          共 {totalCount} 件，合计：<span className="price">{formatPrice(totalPrice)}</span>
        </div>
        <Button color="primary" loading={submitting} onClick={() => void submit()}>
          提交订单
        </Button>
      </div>

      {/* 地址选择弹层 */}
      <Popup
        visible={addrPopup}
        onMaskClick={() => setAddrPopup(false)}
        position="bottom"
        bodyStyle={{ maxHeight: '60vh' }}
      >
        <div className="addr-pop-title">选择收货地址</div>
        <List>
          {addresses.length === 0 ? (
            <div className="empty">
              暂无地址，请到「我的 - 地址管理」添加
              <div>
                <Button
                  size="small"
                  color="primary"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    setAddrPopup(false);
                    navigate('/address/edit');
                  }}
                >
                  去添加地址
                </Button>
              </div>
            </div>
          ) : (
            addresses.map((a) => (
              <List.Item
                key={a.id}
                onClick={() => {
                  setSelectedAddrId(a.id);
                  setAddrPopup(false);
                }}
              >
                <div className="addr-line">
                  <span className="addr-name">{a.receiverName}</span>
                  <span>{a.receiverPhone}</span>
                  {a.id === selectedAddrId && <span className="addr-check">✓</span>}
                </div>
                <div className="addr-detail">
                  {a.province}
                  {a.city}
                  {a.district}
                  {a.detail}
                </div>
              </List.Item>
            ))
          )}
        </List>
      </Popup>
    </div>
  );
}
