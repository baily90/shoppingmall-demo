import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SearchBar, Swiper, Toast } from 'antd-mobile';
import { Gift, Zap, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listBrands, listCategories, listProducts } from '../api/store';
import type { BrandRow, CategoryNode, StoreProductRow } from '../api/store';
import { getHomeSlots } from '../api/home';
import type { HomeSlot } from '../api/home';
import { getErrorMessage } from '../api/request';
import CategoryBar from '../components/CategoryBar';
import ProductCard from '../components/ProductCard';
import BottomTabBar from '../components/TabBar';

const PAGE_SIZE = 10;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// 首页即商品列表页：轮播 Banner + 金刚区 + 领券/秒杀入口 + 分类/品牌/关键词筛选 + 分页加载，底部 TabBar 常驻
export default function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId');
  const categoryIdNum = categoryId ? Number(categoryId) : undefined;
  const brandId = searchParams.get('brandId');
  const brandIdNum = brandId ? Number(brandId) : undefined;
  const keyword = searchParams.get('keyword') ?? '';

  const [banners, setBanners] = useState<HomeSlot[]>([]);
  const [navIcons, setNavIcons] = useState<HomeSlot[]>([]);
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

  // 装修位跳转：0 无 / 1 商品 / 2 分类 / 3 秒杀 / 4 外链
  const handleLink = (linkType: number, linkValue: string | null) => {
    switch (linkType) {
      case 1:
        if (linkValue) navigate(`/product/${linkValue}`);
        break;
      case 2:
        updateParams({ categoryId: linkValue ?? undefined, brandId: undefined });
        break;
      case 3:
        navigate('/seckill');
        break;
      case 4:
        if (linkValue) window.location.href = linkValue;
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    void getHomeSlots()
      .then((r) => {
        setBanners(r.data.data.banners);
        setNavIcons(r.data.data.navIcons);
      })
      .catch(() => {});
  }, []);

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
    <div className="page tab-page home-page">
      <header className="home-header">
        <div className="home-brand">
          <span className="home-brand-mark" />
          商城
        </div>
        <div className="home-search">
          <SearchBar
            placeholder="搜索商品"
            defaultValue={keyword}
            onSearch={(v) => updateParams({ keyword: v || undefined })}
          />
        </div>
      </header>

      {banners.length > 0 && (
        <motion.div
          className="home-banner"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <Swiper autoplay loop>
            {banners.map((b) => (
              <Swiper.Item key={b.id} onClick={() => handleLink(b.linkType, b.linkValue)}>
                <img className="home-banner-img" src={b.image} alt={b.name} />
              </Swiper.Item>
            ))}
          </Swiper>
        </motion.div>
      )}

      {navIcons.length > 0 && (
        <nav className="home-nav">
          {navIcons.map((n, i) => (
            <motion.div
              key={n.id}
              className="nav-icon"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.45, ease: EASE }}
              whileTap={{ scale: 0.94 }}
              onClick={() => handleLink(n.linkType, n.linkValue)}
            >
              <img className="nav-icon-img" src={n.image} alt={n.name} />
              <span className="nav-icon-name">{n.name}</span>
            </motion.div>
          ))}
        </nav>
      )}

      <div className="home-entries">
        <motion.div
          className="entry entry-coupon"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: EASE }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/coupons')}
        >
          <span className="entry-icon">
            <Gift size={18} strokeWidth={1.75} />
          </span>
          <div className="entry-text">
            <div className="entry-title">领券中心</div>
            <div className="entry-sub">限量好券 · 先领再买</div>
          </div>
          <ChevronRight className="entry-arrow" size={16} />
        </motion.div>
        <motion.div
          className="entry entry-seckill"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.45, ease: EASE }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/seckill')}
        >
          <span className="entry-icon">
            <Zap size={18} strokeWidth={1.75} />
          </span>
          <div className="entry-text">
            <div className="entry-title">秒杀专区</div>
            <div className="entry-sub">限时特价 · 手慢无</div>
          </div>
          <ChevronRight className="entry-arrow" size={16} />
        </motion.div>
      </div>

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
