import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, NavBar, Popup, Stepper, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { listCart, removeCartItem, updateCartItem } from '../api/trade';
import type { CartItem } from '../api/trade';
import { listMyCoupons, computeDiscount } from '../api/coupon';
import type { MyCoupon } from '../api/coupon';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';
import BottomTabBar from '../components/TabBar';
import { useCartCount } from '../store/cart';

export default function Cart() {
  const navigate = useNavigate();
  const { refresh } = useCartCount();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [myCoupons, setMyCoupons] = useState<MyCoupon[]>([]);
  const [detailPopup, setDetailPopup] = useState(false);

  const load = async () => {
    try {
      const res = await listCart();
      setItems(res.data.data);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    listMyCoupons()
      .then((res) => setMyCoupons(res.data.data))
      .catch(() => {});
  }, []);

  const onSaleItems = useMemo(() => items.filter((i) => i.onSale), [items]);
  const selectedItems = useMemo(() => onSaleItems.filter((i) => i.selected === 1), [onSaleItems]);
  const totalPrice = useMemo(
    () => selectedItems.reduce((s, i) => s + i.price * i.quantity, 0),
    [selectedItems],
  );
  const allSelected = onSaleItems.length > 0 && onSaleItems.every((i) => i.selected === 1);

  // 可用券（同结算页口径）：未使用 + 未过期 + 满足门槛，取优惠最大的一张做预览
  const usableCoupons = useMemo(
    () =>
      myCoupons
        .filter((c) => c.status === 1 && !c.expired && c.coupon.thresholdAmount <= totalPrice)
        .sort(
          (a, b) => computeDiscount(b.coupon, totalPrice) - computeDiscount(a.coupon, totalPrice),
        ),
    [myCoupons, totalPrice],
  );
  const bestCoupon = usableCoupons[0];
  const discount = bestCoupon
    ? Math.min(computeDiscount(bestCoupon.coupon, totalPrice), totalPrice)
    : 0;

  const patch = (id: number, data: { quantity?: number; selected?: number }) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));
  };

  const toggleSelect = async (item: CartItem, checked: boolean) => {
    try {
      await updateCartItem(item.id, { selected: checked ? 1 : 0 });
      patch(item.id, { selected: checked ? 1 : 0 });
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };

  const toggleSelectAll = async (checked: boolean) => {
    try {
      await Promise.all(
        onSaleItems.map((i) => updateCartItem(i.id, { selected: checked ? 1 : 0 })),
      );
      setItems((prev) => prev.map((i) => (i.onSale ? { ...i, selected: checked ? 1 : 0 } : i)));
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };

  const changeQuantity = async (item: CartItem, qty: number) => {
    try {
      await updateCartItem(item.id, { quantity: qty });
      patch(item.id, { quantity: qty });
      refresh();
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };

  const remove = async (item: CartItem) => {
    try {
      await removeCartItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      refresh();
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };

  const checkout = () => {
    if (selectedItems.length === 0) {
      Toast.show({ content: '请先勾选商品', icon: 'fail' });
      return;
    }
    navigate('/checkout', {
      state: {
        items: selectedItems.map((i) => ({
          skuId: i.skuId,
          quantity: i.quantity,
          name: i.name,
          image: i.image,
          spec: i.spec,
          price: i.price,
        })),
      },
    });
  };

  return (
    <div className="page tab-page">
      <NavBar back={null}>购物车</NavBar>
      {loading ? (
        <div className="empty">加载中…</div>
      ) : items.length === 0 ? (
        <div className="empty">购物车是空的</div>
      ) : (
        <div className="cart-list">
          {items.map((item) => (
            <div key={item.id} className="cart-item">
              <Checkbox
                checked={item.selected === 1}
                onChange={(v) => void toggleSelect(item, v)}
              />
              <img
                className="cart-img"
                src={item.image}
                alt={item.name}
                onClick={() => navigate(`/product/${item.productId}`)}
              />
              <div className="cart-info">
                <div className="cart-name">{item.name}</div>
                {item.spec && <div className="cart-spec">{item.spec}</div>}
                {!item.onSale && <div className="cart-off">已下架</div>}
                <div className="cart-bottom">
                  <span className="price">{formatPrice(item.price)}</span>
                  <Stepper
                    value={item.quantity}
                    min={1}
                    max={item.stock}
                    onChange={(v) => void changeQuantity(item, v)}
                  />
                </div>
              </div>
              <span className="cart-del" onClick={() => void remove(item)}>
                ×
              </span>
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="cart-footer">
          <Checkbox checked={allSelected} onChange={(v) => void toggleSelectAll(v)}>
            全选
          </Checkbox>
          <div className="cart-total" onClick={() => setDetailPopup(true)}>
            <div>
              合计：<span className="price">{formatPrice(totalPrice - discount)}</span>
              <span className="cart-total-arrow">›</span>
            </div>
            {bestCoupon && discount > 0 && (
              <div className="cart-coupon-hint">
                已选「{bestCoupon.coupon.name}」-{formatPrice(discount)}
              </div>
            )}
          </div>
          <Button color="primary" onClick={checkout}>
            去结算({selectedItems.length})
          </Button>
        </div>
      )}
      <Popup visible={detailPopup} onMaskClick={() => setDetailPopup(false)} position="bottom">
        <div className="addr-pop-title">金额明细</div>
        <div className="price-detail">
          <div className="price-detail-row">
            <span>商品总金额</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
          <div className="price-detail-row">
            <span>优惠券{bestCoupon && discount > 0 ? `（${bestCoupon.coupon.name}）` : ''}</span>
            <span className={discount > 0 ? 'price-detail-discount' : ''}>
              {discount > 0 ? `-${formatPrice(discount)}` : '无'}
            </span>
          </div>
          <div className="price-detail-row price-detail-total">
            <span>应付合计</span>
            <span className="price">{formatPrice(totalPrice - discount)}</span>
          </div>
        </div>
      </Popup>
      <BottomTabBar />
    </div>
  );
}
