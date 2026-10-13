import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Rate, Swiper, Toast } from 'antd-mobile';
import { ChevronLeft, Heart, Minus, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProduct } from '../api/store';
import type { ProductDetail, Sku } from '../api/store';
import { listProductReviews } from '../api/review';
import type { ProductReviewItem } from '../api/review';
import { addFavorite, getFavoriteStatus, removeFavorite } from '../api/favorite';
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
  const [favorited, setFavorited] = useState(false);

  // 已登录时拉取收藏状态（红心初始态）
  useEffect(() => {
    if (!user) return;
    void getFavoriteStatus(Number(id))
      .then((r) => setFavorited(r.data.data.favorited))
      .catch(() => {});
  }, [user, id]);

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

  // 收藏/取消收藏：未登录先引导登录，已登录幂等切换
  const toggleFavorite = async () => {
    if (!user) {
      Toast.show({ content: '请先登录', icon: 'fail' });
      navigate('/login', { state: { from: `/product/${id}` } });
      return;
    }
    try {
      if (favorited) {
        await removeFavorite(Number(id));
        setFavorited(false);
        Toast.show({ content: '已取消收藏', icon: 'success' });
      } else {
        await addFavorite(Number(id));
        setFavorited(true);
        Toast.show({ content: '已收藏', icon: 'success' });
      }
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
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

  const maxQty = matchedSku?.stock ?? 99;
  const soldOut = matchedSku != null && matchedSku.stock === 0;

  if (!detail) {
    return (
      <div className="page">
        <header className="detail-header">
          <button className="detail-back" onClick={() => navigate(-1)} aria-label="返回">
            <ChevronLeft size={22} strokeWidth={2.25} />
          </button>
          <div className="detail-header-title">商品详情</div>
        </header>
        <div className="empty">加载中…</div>
      </div>
    );
  }

  return (
    <div className="page detail-page">
      <header className="detail-header">
        <button className="detail-back" onClick={() => navigate(-1)} aria-label="返回">
          <ChevronLeft size={22} strokeWidth={2.25} />
        </button>
        <div className="detail-header-title">商品详情</div>
      </header>

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
          <div className="detail-price-main">
            <span className="price">{formatPrice(displayPrice)}</span>
            {matchedSku?.originalPrice != null && matchedSku.originalPrice > matchedSku.price && (
              <span className="original">{formatPrice(matchedSku.originalPrice)}</span>
            )}
            {!matchedSku && detail.skus.length > 1 && <span className="from">起</span>}
          </div>
          <motion.button
            type="button"
            className={`detail-fav${favorited ? ' active' : ''}`}
            whileTap={{ scale: 0.9 }}
            onClick={() => void toggleFavorite()}
          >
            <Heart size={20} fill={favorited ? 'currentColor' : 'none'} strokeWidth={1.75} />
            <span>{favorited ? '已收藏' : '收藏'}</span>
          </motion.button>
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
                  <motion.button
                    key={v.id}
                    type="button"
                    className={`spec-chip${active ? ' active' : ''}`}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => toggleSpec(group.id, v.id)}
                  >
                    {v.value}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="spec-group">
          <div className="spec-group-name">数量</div>
          <div className="qty">
            <button
              type="button"
              className="qty-btn"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus size={16} />
            </button>
            <span className="qty-num">{quantity}</span>
            <button
              type="button"
              className="qty-btn"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            >
              <Plus size={16} />
            </button>
          </div>
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
          <div className="review-summary">
            <span className="review-summary-score">{detail.ratingAvg.toFixed(1)}</span>
            <Rate readOnly allowHalf value={Math.round(detail.ratingAvg * 2) / 2} />
          </div>
        )}
        {reviews.length === 0 && <div className="empty">暂无评价</div>}
        {sortedReviews.map((r) => (
          <div key={r.id} className="review-item">
            <div className="review-head">
              <span className="review-user">
                {r.nickname}
                {r.skuSpec ? ` · ${r.skuSpec}` : ''}
                {r.mine && <span className="review-mine">我的评价</span>}
              </span>
              <Rate readOnly value={r.rating} style={{ '--star-size': '12px' }} />
            </div>
            {r.content && <div className="review-content">{r.content}</div>}
            {r.images.length > 0 && (
              <div className="review-images">
                {r.images.map((url, idx) => (
                  <img key={idx} src={url} alt="" className="review-image" />
                ))}
              </div>
            )}
            <div className="review-time">{r.createdAt.slice(0, 10)}</div>
            {r.replyContent && (
              <div className="review-reply">
                <span className="review-reply-label">商家回复</span>
                <div className="review-reply-content">{r.replyContent}</div>
                {r.replyAt && <div className="review-reply-time">{r.replyAt.slice(0, 10)}</div>}
              </div>
            )}
          </div>
        ))}
        {reviews.length < reviewTotal && (
          <button type="button" className="more" onClick={() => void loadReviews(reviewPage + 1)}>
            加载更多评价
          </button>
        )}
      </div>

      <div className="detail-footer">
        <motion.button
          type="button"
          className="btn btn-ghost"
          whileTap={{ scale: 0.97 }}
          onClick={() => void addToCart()}
          disabled={soldOut}
        >
          加入购物车
        </motion.button>
        <motion.button
          type="button"
          className="btn btn-primary"
          whileTap={{ scale: 0.97 }}
          onClick={buyNow}
          disabled={soldOut}
        >
          立即购买
        </motion.button>
      </div>
    </div>
  );
}
