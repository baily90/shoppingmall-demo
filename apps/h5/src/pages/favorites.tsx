import { useCallback, useEffect, useState } from 'react';
import { Button, NavBar, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { listFavorites, removeFavorite } from '../api/favorite';
import type { FavoriteItem } from '../api/favorite';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';

const PAGE_SIZE = 10;

export default function Favorites() {
  const navigate = useNavigate();
  const [list, setList] = useState<FavoriteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    try {
      const res = await listFavorites({ page: p, pageSize: PAGE_SIZE });
      const d = res.data.data;
      setList((prev) => (p === 1 ? d.list : [...prev, ...d.list]));
      setTotal(d.total);
      setPage(p);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const cancel = async (item: FavoriteItem) => {
    try {
      await removeFavorite(item.productId);
      setList((prev) => prev.filter((f) => f.id !== item.id));
      setTotal((t) => t - 1);
      Toast.show({ content: '已取消收藏', icon: 'success' });
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>我的收藏</NavBar>
      {loading ? (
        <div className="empty">加载中…</div>
      ) : list.length === 0 ? (
        <div className="empty">还没有收藏商品</div>
      ) : (
        <div className="cart-list">
          {list.map((item) => {
            const invalid = item.product.deleted || item.product.status !== 1;
            return (
              <div key={item.id} className="cart-item">
                <div className="fav-main" onClick={() => navigate(`/product/${item.productId}`)}>
                  {item.product.mainImage && (
                    <img className="cart-img" src={item.product.mainImage} alt="" />
                  )}
                  <div className="cart-info">
                    <div className="cart-name">{item.product.name}</div>
                    {invalid ? (
                      <div className="cart-off">已失效</div>
                    ) : item.price != null ? (
                      <div className="price" style={{ marginTop: 4 }}>
                        {formatPrice(item.price)}
                      </div>
                    ) : null}
                  </div>
                </div>
                <Button size="mini" color="danger" fill="outline" onClick={() => void cancel(item)}>
                  取消收藏
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {list.length < total && (
        <Button
          block
          size="small"
          style={{ margin: '8px 0' }}
          loading={loading}
          onClick={() => void load(page + 1)}
        >
          加载更多
        </Button>
      )}
    </div>
  );
}
