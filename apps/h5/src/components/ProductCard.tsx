import { useNavigate } from 'react-router-dom';
import { formatPrice } from '../utils/price';
import type { StoreProductRow } from '../api/store';

export default function ProductCard({ product }: { product: StoreProductRow }) {
  const navigate = useNavigate();

  return (
    <div className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
      <img className="product-card-img" src={product.mainImage} alt={product.name} />
      <div className="product-card-name">{product.name}</div>
      {product.subTitle && <div className="product-card-sub">{product.subTitle}</div>}
      <div className="product-card-price">
        <span className="price">{formatPrice(product.price)}</span>
        {product.originalPrice != null && product.originalPrice > (product.price ?? 0) && (
          <span className="original">{formatPrice(product.originalPrice)}</span>
        )}
      </div>
    </div>
  );
}
