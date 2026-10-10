import { useEffect, useMemo, useState } from 'react';
import { Button, NavBar, Rate, Stepper, Swiper, Tag, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { getProduct } from '../api/store';
import type { ProductDetail, Sku } from '../api/store';
import { listProductReviews } from '../api/review';
import type { ProductReviewItem } from '../api/review';
import { addToCart as addToCartApi } from '../api/trade';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';
import { useAuth } from '../store/auth';
import { useCartCount } from '../store/cart';

export default function Detail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { refresh } = useCartCount();

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  // 已选规格：groupId -> specValueId
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<ProductReviewItem[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getProduct(Number(id));
        setDetail(res.data.data);
      } catch (e) {
        Toast.show({ content: getErrorMessage(e), icon: 'fail' });
      }
    })();
  }, [id]);

  const loadReviews = async (page: number) => {
    try {
      const res = await listProductReviews(Number(id), { page, pageSize: 10 });
      const d = res.data.data;
      setReviews((prev) => (page === 1 ? d.list : [...prev, ...d.list]));
      setReviewTotal(d.total);
      setReviewPage(page);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };
  useEffect(() => {
    void loadReviews(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 进入页面默认选中第一个 SKU 对应的规格，点击「加入购物车/立即购买」即可直接下单
  useEffect(() => {
    if (!detail) return;
    const firstSku = detail.skus[0];
    if (!firstSku) return;
    const init: Record<number, number> = {};
    for (const sv of firstSku.specValues) {
      init[sv.groupId] = sv.id;
    }
    setSelected(init);
  }, [detail]);

  const images = useMemo(() => {
    if (!detail) return [];
    const list = detail.images.length ? detail.images.map((i) => i.url) : [detail.mainImage];
    return list.length ? list : [];
  }, [detail]);

  // 置顶当前用户自己的评价（「我的评价」），其余按时间倒序保持原序
  const sortedReviews = useMemo(
    () => [...reviews].sort((a, b) => Number(b.mine) - Number(a.mine)),
    [reviews],
  );

  // 已选全所有规格 → 匹配到唯一 SKU
  const matchedSku: Sku | null = useMemo(() => {
    if (!detail) return null;
    const groupCount = detail.specGroups.length;
    if (Object.keys(selected).length !== groupCount) return null;
    return (
      detail.skus.find(
        (sku) =>
          sku.specValues.length === groupCount &&
          sku.specValues.every((sv) => selected[sv.groupId] === sv.id),
      ) ?? null
    );
  }, [detail, selected]);

  const minPrice = useMemo(() => {
    if (!detail || detail.skus.length === 0) return null;
    return Math.min(...detail.skus.map((s) => s.price));
  }, [detail]);

  const displayPrice = matchedSku ? matchedSku.price : minPrice;

  const toggleSpec = (groupId: number, valueId: number) => {
    setSelected((prev) => ({ ...prev, [groupId]: valueId }));
  };

  // 未登录或未选全规格时返回 null，阻止后续操作
  const ensureReady = (): Sku | null => {
    if (!user) {
      Toast.show({ content: '请先登录', icon: 'fail' });
      navigate('/login', { state: { from: `/product/${id}` } });
      return null;
    }
    if (!matchedSku) {
      Toast.show({ content: '请先选择规格', icon: 'fail' });
      return null;
    }
    return matchedSku;
  };

  const addToCart = async () => {
    const sku = ensureReady();
    if (!sku) return;
    try {
      await addToCartApi(sku.id, quantity);
      Toast.show({ content: '已加入购物车', icon: 'success' });
      refresh();
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };

  const buyNow = () => {
    const sku = ensureReady();
    if (!sku || !detail) return;
    const specText = sku.specValues.map((v) => `${v.groupName}:${v.value}`).join(' / ');
    navigate('/checkout', {
      state: {
        items: [
          {
            skuId: sku.id,
            quantity,
            name: detail.name,
            image: sku.image ?? detail.mainImage,
            spec: specText,
            price: sku.price,
          },
        ],
      },
    });
  };

  if (!detail) {
    return (
      <div className="page">
        <NavBar onBack={() => navigate(-1)}>商品详情</NavBar>
        <div className="empty">加载中…</div>
      </div>
    );
  }

  return (
    <div className="page detail-page">
      <NavBar onBack={() => navigate(-1)}>商品详情</NavBar>

      {images.length > 0 && (
        <Swiper>
          {images.map((url) => (
            <Swiper.Item key={url}>
              <img className="detail-img" src={url} alt="" />
            </Swiper.Item>
          ))}
        </Swiper>
      )}

      <div className="detail-body">
        <div className="detail-price-row">
          <span className="price">{formatPrice(displayPrice)}</span>
          {matchedSku?.originalPrice != null && matchedSku.originalPrice > matchedSku.price && (
            <span className="original">{formatPrice(matchedSku.originalPrice)}</span>
          )}
          {!matchedSku && detail.skus.length > 1 && <span className="from">起</span>}
        </div>
        <h1 className="detail-name">{detail.name}</h1>
        {detail.subTitle && <div className="detail-sub">{detail.subTitle}</div>}

        {detail.specGroups.map((group) => (
          <div key={group.id} className="spec-group">
            <div className="spec-group-name">{group.name}</div>
            <div className="spec-values">
              {group.values.map((v) => {
                const active = selected[group.id] === v.id;
                return (
                  <Tag
                    key={v.id}
                    color={active ? 'primary' : 'default'}
                    fill={active ? 'solid' : 'outline'}
                    onClick={() => toggleSpec(group.id, v.id)}
                  >
                    {v.value}
                  </Tag>
                );
              })}
            </div>
          </div>
        ))}

        <div className="spec-group">
          <div className="spec-group-name">数量</div>
          <Stepper
            value={quantity}
            min={1}
            max={matchedSku?.stock ?? 99}
            onChange={(v) => setQuantity(v)}
          />
        </div>

        {matchedSku && (
          <div className="stock-tip">
            {matchedSku.stock > 0 ? `库存 ${matchedSku.stock} 件` : '已售罄'}
          </div>
        )}
      </div>

      {detail.detail && (
        <div className="detail-desc">
          <div className="detail-desc-title">商品详情</div>
          <div className="detail-desc-content">{detail.detail}</div>
        </div>
      )}

      <div className="detail-desc">
        <div className="detail-desc-title">商品评价（{detail.reviewCount}）</div>
        {detail.reviewCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#ff4d4f' }}>
              {detail.ratingAvg.toFixed(1)}
            </span>
            <Rate readOnly allowHalf value={Math.round(detail.ratingAvg * 2) / 2} />
          </div>
        )}
        {reviews.length === 0 && <div className="empty">暂无评价</div>}
        {sortedReviews.map((r) => (
          <div key={r.id} style={{ padding: '10px 0', borderTop: '1px solid #f5f5f5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 13,
                  color: '#999',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {r.nickname}
                {r.skuSpec ? ` · ${r.skuSpec}` : ''}
                {r.mine && (
                  <Tag color="primary" fill="outline">
                    我的评价
                  </Tag>
                )}
              </span>
              <Rate readOnly value={r.rating} style={{ '--star-size': '12px' }} />
            </div>
            {r.content && <div style={{ marginTop: 6, fontSize: 14 }}>{r.content}</div>}
            {r.images.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {r.images.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt=""
                    style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 4 }}
                  />
                ))}
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 12, color: '#bbb' }}>
              {r.createdAt.slice(0, 10)}
            </div>
          </div>
        ))}
        {reviews.length < reviewTotal && (
          <Button
            block
            size="small"
            style={{ marginTop: 8 }}
            onClick={() => void loadReviews(reviewPage + 1)}
          >
            加载更多评价
          </Button>
        )}
      </div>

      <div className="detail-footer">
        <Button
          block
          color="primary"
          size="large"
          onClick={() => void addToCart()}
          disabled={matchedSku != null && matchedSku.stock === 0}
        >
          加入购物车
        </Button>
        <Button
          block
          color="danger"
          size="large"
          onClick={buyNow}
          disabled={matchedSku != null && matchedSku.stock === 0}
        >
          立即购买
        </Button>
      </div>
    </div>
  );
}
