import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, List, NavBar, Popup, TextArea, Toast } from 'antd-mobile';
import { Check, ChevronRight, MapPin } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createOrder, listAddresses } from '../api/trade';
import type { Address } from '../api/trade';
import { listMyCoupons, computeDiscount } from '../api/coupon';
import type { MyCoupon } from '../api/coupon';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';
import { useCartCount } from '../store/cart';
import CouponCard from '../components/CouponCard';

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
  // 优惠券相关
  const [myCoupons, setMyCoupons] = useState<MyCoupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<number | undefined>();
  const [couponPopup, setCouponPopup] = useState(false);
  // 幂等键：本次结算页生成一次，重复点击「提交订单」复用同一 key，后端据此去重
  const idempotencyKey = useRef(crypto.randomUUID()).current;

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

  useEffect(() => {
    listMyCoupons()
      .then((res) => setMyCoupons(res.data.data))
      .catch(() => {});
  }, []);

  const selectedAddr = addresses.find((a) => a.id === selectedAddrId);
  const totalPrice = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const totalCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  // 可用券：未使用 + 未过期 + 满足门槛，按优惠金额从高到低排序
  const usableCoupons = useMemo(
    () =>
      myCoupons
        .filter((c) => c.status === 1 && !c.expired && c.coupon.thresholdAmount <= totalPrice)
        .sort(
          (a, b) => computeDiscount(b.coupon, totalPrice) - computeDiscount(a.coupon, totalPrice),
        ),
    [myCoupons, totalPrice],
  );

  // 默认选中最高优惠（行业惯例）；用户手动选「不使用」后不再自动覆盖
  const [autoPicked, setAutoPicked] = useState(false);
  useEffect(() => {
    if (!autoPicked && usableCoupons.length > 0) {
      setSelectedCouponId(usableCoupons[0].id);
      setAutoPicked(true);
    }
  }, [usableCoupons, autoPicked]);

  const selectedCoupon = useMemo(
    () => myCoupons.find((c) => c.id === selectedCouponId),
    [myCoupons, selectedCouponId],
  );
  const discount = useMemo(
    () =>
      selectedCoupon ? Math.min(computeDiscount(selectedCoupon.coupon, totalPrice), totalPrice) : 0,
    [selectedCoupon, totalPrice],
  );

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
        couponId: selectedCouponId,
        idempotencyKey,
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
        <MapPin className="checkout-addr-pin" size={20} strokeWidth={1.75} />
        <div className="checkout-addr-text">
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
        </div>
        <ChevronRight className="addr-arrow" size={18} strokeWidth={2} />
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

      {/* 优惠券 */}
      <div className="checkout-block" onClick={() => setCouponPopup(true)}>
        <div className="checkout-coupon-row">
          <span>优惠券</span>
          <span className="checkout-coupon-value">
            {selectedCoupon
              ? `-${formatPrice(discount)}`
              : usableCoupons.length > 0
                ? `${usableCoupons.length} 张可用`
                : '暂无可用'}
            <ChevronRight size={15} strokeWidth={2} style={{ color: 'var(--c-text-3)' }} />
          </span>
        </div>
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
          共 {totalCount} 件{discount > 0 && <span>，已优惠 {formatPrice(discount)}</span>}
          ，合计：<span className="price">{formatPrice(totalPrice - discount)}</span>
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
                  {a.id === selectedAddrId && (
                    <Check className="addr-check" size={18} strokeWidth={2.5} />
                  )}
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

      {/* 优惠券选择弹层 */}
      <Popup
        visible={couponPopup}
        onMaskClick={() => setCouponPopup(false)}
        position="bottom"
        bodyStyle={{ maxHeight: '70vh' }}
      >
        <div className="addr-pop-title">选择优惠券</div>
        <div className="coupon-select">
          <div
            className="coupon-select-none"
            onClick={() => {
              setSelectedCouponId(undefined);
              setCouponPopup(false);
            }}
          >
            <span>不使用优惠券</span>
            {selectedCouponId === undefined && (
              <Check className="addr-check" size={18} strokeWidth={2.5} />
            )}
          </div>
          {usableCoupons.length === 0 ? (
            <div className="empty">暂无可用优惠券</div>
          ) : (
            usableCoupons.map((c) => (
              <div
                key={c.id}
                className="coupon-select-item"
                onClick={() => {
                  setSelectedCouponId(c.id);
                  setCouponPopup(false);
                }}
              >
                <CouponCard coupon={c.coupon}>
                  {c.id === selectedCouponId && (
                    <Check className="addr-check" size={18} strokeWidth={2.5} />
                  )}
                </CouponCard>
              </div>
            ))
          )}
        </div>
      </Popup>
    </div>
  );
}
