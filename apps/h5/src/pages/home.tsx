import { useEffect, useState } from 'react';
import { NavBar, SearchBar, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { listCategories, listProducts } from '../api/store';
import type { CategoryNode, StoreProductRow } from '../api/store';
import { getErrorMessage } from '../api/request';
import CategoryBar from '../components/CategoryBar';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<StoreProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          listCategories(),
          listProducts({ page: 1, pageSize: 10 }),
        ]);
        setCategories(catRes.data.data);
        setProducts(prodRes.data.data.list);
      } catch (e) {
        Toast.show({ content: getErrorMessage(e), icon: 'fail' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="page">
      <NavBar>商城</NavBar>
      <SearchBar
        placeholder="搜索商品"
        onSearch={(v) => navigate(`/list?keyword=${encodeURIComponent(v)}`)}
      />
      <CategoryBar
        categories={categories}
        onSelect={(id) => navigate(id != null ? `/list?categoryId=${id}` : '/list')}
      />

      {loading ? (
        <div className="empty">加载中…</div>
      ) : products.length === 0 ? (
        <div className="empty">暂无商品</div>
      ) : (
        <>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="more" onClick={() => navigate('/list')}>
            查看更多 ›
          </div>
        </>
      )}
    </div>
  );
}
