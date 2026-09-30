import { useEffect, useMemo, useState } from 'react';
import { Button, NavBar, Stepper, Swiper, Tag, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { getProduct } from '../api/store';
import type { ProductDetail, Sku } from '../api/store';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';

export default function Detail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  // 已选规格：groupId -> specValueId
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [quantity, setQuantity] = useState(1);

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

  const images = useMemo(() => {
    if (!detail) return [];
    const list = detail.images.length ? detail.images.map((i) => i.url) : [detail.mainImage];
    return list.length ? list : [];
  }, [detail]);

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

  const addToCart = () => {
    Toast.show({ content: '购物车将在阶段 3 实现', icon: 'fail' });
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

      <div className="detail-footer">
        <Button
          block
          color="primary"
          size="large"
          onClick={addToCart}
          disabled={matchedSku != null && matchedSku.stock === 0}
        >
          加入购物车
        </Button>
      </div>
    </div>
  );
}
