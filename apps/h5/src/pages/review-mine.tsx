import { useCallback, useEffect, useState } from 'react';
import { Button, NavBar, Rate, Tag, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { listMyReviews } from '../api/review';
import type { MyReviewItem } from '../api/review';
import { getErrorMessage } from '../api/request';

const PAGE_SIZE = 10;

export default function ReviewMine() {
  const navigate = useNavigate();
  const [list, setList] = useState<MyReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    try {
      const res = await listMyReviews({ page: p, pageSize: PAGE_SIZE });
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

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>我的评价</NavBar>
      {loading ? (
        <div className="empty">加载中…</div>
      ) : list.length === 0 ? (
        <div className="empty">还没有评价过商品</div>
      ) : (
        <div className="order-list">
          {list.map((r) => (
            <div key={r.id} className="order-card">
              <div className="od-item" onClick={() => navigate(`/product/${r.productId}`)}>
                {r.product.mainImage && (
                  <img className="order-img" src={r.product.mainImage} alt="" />
                )}
                <div className="od-item-meta">
                  <div className="cart-name">{r.product.name}</div>
                  {r.skuSpec && <div className="cart-spec">{r.skuSpec}</div>}
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Rate readOnly value={r.rating} style={{ '--star-size': '14px' }} />
                {r.status === 0 && <Tag color="default">已屏蔽</Tag>}
                {r.anonymous && <span style={{ color: '#999', fontSize: 12 }}>匿名</span>}
              </div>
              {r.content && (
                <div style={{ marginTop: 6, fontSize: 14, color: '#333' }}>{r.content}</div>
              )}
              {r.images.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {r.images.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt=""
                      style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 4 }}
                    />
                  ))}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 12, color: '#bbb' }}>
                {r.createdAt.slice(0, 19).replace('T', ' ')}
              </div>
              {r.replyContent && (
                <div className="review-reply">
                  <span className="review-reply-label">商家回复</span>
                  <div className="review-reply-content">{r.replyContent}</div>
                  {r.replyAt && (
                    <div className="review-reply-time">
                      {r.replyAt.slice(0, 19).replace('T', ' ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
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
