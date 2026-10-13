import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '../utils/price';
import type { StoreProductRow } from '../api/store';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function ProductCard({ product }: { product: StoreProductRow }) {
  const navigate = useNavigate();

  return (
    <motion.div
      className="product-card"
      onClick={() => navigate(`/product/${product.id}`)}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.45, ease: EASE }}
      whileTap={{ scale: 0.97 }}
    >
      <img className="product-card-img" src={product.mainImage} alt={product.name} />
      <div className="product-card-body">
        <div className="product-card-name">{product.name}</div>
        {product.subTitle && <div className="product-card-sub">{product.subTitle}</div>}
        <div className="product-card-price">
          <span className="price">{formatPrice(product.price)}</span>
          {product.originalPrice != null && product.originalPrice > (product.price ?? 0) && (
            <span className="original">{formatPrice(product.originalPrice)}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
