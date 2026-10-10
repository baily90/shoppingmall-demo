import { useEffect, useState } from 'react';
import { Button, Checkbox, ImageUploader, NavBar, Rate, TextArea, Toast } from 'antd-mobile';
import type { ImageUploadItem } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { getOrder } from '../api/trade';
import type { OrderDetail, OrderItem } from '../api/trade';
import { createReview, uploadImage } from '../api/review';
import { getErrorMessage } from '../api/request';

interface Draft {
  rating: number;
  content: string;
  images: ImageUploadItem[];
  anonymous: boolean;
}

const emptyDraft = (): Draft => ({ rating: 5, content: '', images: [], anonymous: false });

export default function ReviewApply() {
  const navigate = useNavigate();
  const { id } = useParams();
  const orderId = Number(id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getOrder(orderId);
        const o = res.data.data;
        setOrder(o);
        // 为每个未评价订单项初始化表单草稿
        const init: Record<number, Draft> = {};
        for (const it of o.items) {
          if (!it.review) init[it.id] = emptyDraft();
        }
        setDrafts(init);
      } catch (e) {
        Toast.show({ content: getErrorMessage(e), icon: 'fail' });
      }
    })();
  }, [orderId]);

  const updateDraft = (itemId: number, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? emptyDraft()), ...patch } }));
  };

  const submit = async (item: OrderItem) => {
    const draft = drafts[item.id];
    if (!draft) return;
    setSubmittingId(item.id);
    try {
      await createReview({
        orderId,
        orderItemId: item.id,
        rating: draft.rating,
        content: draft.content.trim() || undefined,
        images: draft.images.map((f) => f.url),
        anonymous: draft.anonymous,
      });
      Toast.show({ content: '评价成功', icon: 'success' });
      // 重新拉取订单，把该商品刷成「已评价」
      const res = await getOrder(orderId);
      setOrder(res.data.data);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setSubmittingId(null);
    }
  };

  if (!order) {
    return (
      <div className="page">
        <NavBar onBack={() => navigate(-1)}>评价</NavBar>
        <div className="empty">加载中…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>评价</NavBar>
      {order.items.map((item) => {
        const reviewed = item.review;
        const draft = drafts[item.id];
        return (
          <div key={item.id} className="od-card">
            <div className="od-item">
              {item.productImage && <img className="order-img" src={item.productImage} alt="" />}
              <div className="od-item-meta">
                <div className="cart-name">{item.productName}</div>
                {item.skuSpec && <div className="cart-spec">{item.skuSpec}</div>}
              </div>
            </div>

            {reviewed ? (
              <div style={{ marginTop: 8 }}>
                <Rate readOnly value={reviewed.rating} />
                {reviewed.content && <div className="cart-spec">{reviewed.content}</div>}
                <div style={{ color: '#999', fontSize: 12 }}>已评价</div>
              </div>
            ) : draft ? (
              <div style={{ marginTop: 8 }}>
                <Rate value={draft.rating} onChange={(v) => updateDraft(item.id, { rating: v })} />
                <div style={{ marginTop: 8 }}>
                  <TextArea
                    placeholder="说说商品使用感受（选填）"
                    value={draft.content}
                    onChange={(v) => updateDraft(item.id, { content: v })}
                    maxLength={500}
                    rows={3}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <ImageUploader
                    value={draft.images}
                    onChange={(v) => updateDraft(item.id, { images: v })}
                    upload={async (file) => ({ url: (await uploadImage(file)).data.data.url })}
                    maxCount={9}
                    imageFit="contain"
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <Checkbox
                    checked={draft.anonymous}
                    onChange={(v) => updateDraft(item.id, { anonymous: v })}
                  >
                    匿名评价
                  </Checkbox>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Button
                    block
                    color="primary"
                    size="small"
                    loading={submittingId === item.id}
                    onClick={() => void submit(item)}
                  >
                    提交评价
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      <Button
        block
        fill="outline"
        color="primary"
        style={{ marginTop: 12 }}
        onClick={() => navigate('/reviews/mine')}
      >
        查看我的评价
      </Button>
    </div>
  );
}
