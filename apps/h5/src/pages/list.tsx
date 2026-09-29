import { useEffect, useState } from 'react';
import { NavBar, SearchBar, Toast } from 'antd-mobile';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { flattenCategories, listCategories, listProducts } from '../api/store';
import type { FlatCategory, StoreProductRow } from '../api/store';
import { getErrorMessage } from '../api/request';
import CategoryBar from '../components/CategoryBar';
import ProductCard from '../components/ProductCard';

const PAGE_SIZE = 10;

export default function List() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId');
  const categoryIdNum = categoryId ? Number(categoryId) : undefined;
  const keyword = searchParams.get('keyword') ?? '';

  const [categories, setCategories] = useState<FlatCategory[]>([]);
  const [products, setProducts] = useState<StoreProductRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void listCategories()
      .then((r) => setCategories(flattenCategories(r.data.data)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      try {
        const res = await listProducts({
          page: 1,
          pageSize: PAGE_SIZE,
          keyword: keyword || undefined,
          categoryId: categoryIdNum,
        });
        setProducts(res.data.data.list);
        setTotal(res.data.data.total);
        setPage(1);
      } catch (e) {
        Toast.show({ content: getErrorMessage(e), icon: 'fail' });
      } finally {
        setLoading(false);
      }
    })();
  }, [keyword, categoryIdNum]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await listProducts({
        page: page + 1,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        categoryId: categoryIdNum,
      });
      setProducts((prev) => [...prev, ...res.data.data.list]);
      setTotal(res.data.data.total);
      setPage(page + 1);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const hasMore = products.length < total;

  const selectCategory = (id?: number) => {
    if (id != null) setSearchParams({ categoryId: String(id) });
    else setSearchParams({});
  };

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>商品列表</NavBar>
      <SearchBar
        placeholder="搜索商品"
        defaultValue={keyword}
        onSearch={(v) => (v ? setSearchParams({ keyword: v }) : setSearchParams({}))}
      />
      <CategoryBar categories={categories} activeId={categoryIdNum} onSelect={selectCategory} />

      {products.length === 0 && !loading ? (
        <div className="empty">暂无商品</div>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
      {loading && <div className="empty">加载中…</div>}
      {!loading && hasMore && (
        <div className="more" onClick={() => void loadMore()}>
          加载更多
        </div>
      )}
      {!loading && !hasMore && products.length > 0 && <div className="more muted">没有更多了</div>}
    </div>
  );
}
