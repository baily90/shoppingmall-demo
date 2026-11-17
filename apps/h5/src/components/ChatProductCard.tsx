import { useNavigate } from 'react-router-dom';
import { goBuyNow } from '../utils/buy';
import Img from './Img';

// 客服工具返回的商品结构化数据（getProducts 输出）
export interface ChatProduct {
  id: number;
  name: string;
  brand?: string | null;
  subTitle?: string | null;
  price?: string | null; // 展示用（元，如 ¥10044）
  priceCent?: number | null; // 下单用（分）
  originalPrice?: string | null;
  image?: string | null;
  skuId?: number | null;
  ratingAvg?: number;
  reviewCount?: number;
}

/**
 * 聊天里的商品卡片：点击进详情，右下角「立即购买」直接进结算。
 * 行为复用 goBuyNow（与详情页同一套下单逻辑）。
 */
export default function ChatProductCard({ product }: { product: ChatProduct }) {
  const navigate = useNavigate();

  const buy = () => {
    if (product.skuId == null || product.priceCent == null) return;
    goBuyNow(navigate, [
      {
        skuId: product.skuId,
        quantity: 1,
        name: product.name,
        image: product.image ?? '',
        spec: '',
        price: product.priceCent,
      },
    ]);
  };

  return (
    <div className="chat-product-card" onClick={() => navigate(`/product/${product.id}`)}>
      <Img className="chat-product-img" src={product.image} alt={product.name} />
      <div className="chat-product-info">
        <div className="chat-product-name">{product.name}</div>
        <div className="chat-product-meta">
          {product.brand && <span className="chat-product-brand">{product.brand}</span>}
          {product.ratingAvg != null && product.ratingAvg > 0 && (
            <span className="chat-product-rating">{product.ratingAvg} 分</span>
          )}
        </div>
        {product.price != null && <div className="price chat-product-price">{product.price}</div>}
      </div>
      <button
        type="button"
        className="chat-product-buy"
        onClick={(e) => {
          e.stopPropagation();
          buy();
        }}
      >
        立即购买
      </button>
    </div>
  );
}
