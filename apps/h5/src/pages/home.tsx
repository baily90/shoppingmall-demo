import { useEffect, useState } from 'react';
import { NavBar, SearchBar, Toast } from 'antd-mobile';
import { useSearchParams } from 'react-router-dom';
import { listBrands, listCategories, listProducts } from '../api/store';
import type { BrandRow, CategoryNode, StoreProductRow } from '../api/store';
import { getErrorMessage } from '../api/request';
import CategoryBar from '../components/CategoryBar';
import ProductCard from '../components/ProductCard';
import BottomTabBar from '../components/TabBar';

const PAGE_SIZE = 10;

// 首页即商品列表页：分类/品牌/关键词筛选 + 分页加载，底部 TabBar 常驻
export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId');
  const categoryIdNum = categoryId ? Number(categoryId) : undefined;
  const brandId = searchParams.get('brandId');
  const brandIdNum = brandId ? Number(brandId) : undefined;
  const keyword = searchParams.get('keyword') ?? '';

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [products, setProducts] = useState<StoreProductRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 合并更新查询参数，避免互相覆盖（分类/品牌/关键词可叠加）
  const updateParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next);
  };

  useEffect(() => {
    void listCategories()
      .then((r) => setCategories(r.data.data))
      .catch(() => {});
  }, []);

  // 品牌列表随当前分类变化（限定在该分类下有在售商品的品牌）
  useEffect(() => {
    void listBrands({ categoryId: categoryIdNum })
      .then((r) => setBrands(r.data.data.list))
      .catch(() => setBrands([]));
  }, [categoryIdNum]);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      try {
        const res = await listProducts({
          page: 1,
          pageSize: PAGE_SIZE,
          keyword: keyword || undefined,
          categoryId: categoryIdNum,
          brandId: brandIdNum,
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
  }, [keyword, categoryIdNum, brandIdNum]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await listProducts({
        page: page + 1,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        categoryId: categoryIdNum,
        brandId: brandIdNum,
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
    // 切换分类时重置品牌（品牌列表随分类变化，原选中品牌可能已不存在）
    updateParams({ categoryId: id != null ? String(id) : undefined, brandId: undefined });
  };

  return (
    <div className="page tab-page">
      <NavBar back={null}>商城</NavBar>
      <SearchBar
        placeholder="搜索商品"
        defaultValue={keyword}
        onSearch={(v) => updateParams({ keyword: v || undefined })}
      />
      <CategoryBar categories={categories} activeId={categoryIdNum} onSelect={selectCategory} />

      {brands.length > 0 && (
        <div className="category-bar">
          <span className="filter-label">品牌：</span>
          <div
            className={brandIdNum == null ? 'category-chip active' : 'category-chip'}
            onClick={() => updateParams({ brandId: undefined })}
          >
            全部
          </div>
          {brands.map((b) => (
            <div
              key={b.id}
              className={brandIdNum === b.id ? 'category-chip active' : 'category-chip'}
              onClick={() => updateParams({ brandId: String(b.id) })}
            >
              {b.name}
            </div>
          ))}
        </div>
      )}

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

      <BottomTabBar />
    </div>
  );
}
