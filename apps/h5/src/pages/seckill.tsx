import { useEffect, useRef, useState } from 'react';
import { Button, NavBar, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { getSeckillActivities, grabSeckill, getSeckillResult } from '../api/seckill';
import type { SeckillActivity } from '../api/seckill';
import { listAddresses } from '../api/trade';
import { getErrorMessage } from '../api/request';
import { formatPrice } from '../utils/price';

const MAX_POLL_TIMES = 30; // 最多轮询 30 秒

const cardKey = (activityId: number, skuId: number) => `${activityId}:${skuId}`;

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function Seckill() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<SeckillActivity[]>([]);
  const [hasAddress, setHasAddress] = useState(true);
  const [grabbingKey, setGrabbingKey] = useState<string | null>(null);
  // 本次会话已抢到的商品：key -> orderId，卡片上显示「去支付」
  const [won, setWon] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const [a, addr] = await Promise.all([getSeckillActivities(), listAddresses()]);
      setActivities(a.data.data);
      setHasAddress(addr.data.data.length > 0);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const stopPoll = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => stopPoll, []);

  // 抢到资格后轮询异步落单结果；recovered=true 表示「已抢过找回」，直接跳订单详情
  const poll = (requestId: string, key: string, recovered = false) => {
    let times = 0;
    stopPoll();
    timerRef.current = setInterval(async () => {
      times += 1;
      try {
        const res = await getSeckillResult(requestId);
        const r = res.data.data;
        if (r.status !== 'pending') {
          stopPoll();
          setGrabbingKey(null);
          if (r.status === 'success') {
            if (recovered) {
              Toast.show({ content: '已抢购该商品', icon: 'info' });
              navigate(`/order/${r.orderId}`);
            } else {
              Toast.show({ content: '抢到啦！', icon: 'success' });
              setWon((prev) => ({ ...prev, [key]: r.orderId! }));
            }
          } else {
            Toast.show({ content: r.message ?? '抢购失败', icon: 'fail' });
          }
        } else if (times >= MAX_POLL_TIMES) {
          stopPoll();
          setGrabbingKey(null);
          Toast.show({ content: '结果确认中，请到订单列表查看', icon: 'fail' });
        }
      } catch {
        // 轮询失败忽略，等下一次
      }
    }, 1000);
  };

  const onGrab = async (activity: SeckillActivity, skuId: number) => {
    if (!hasAddress) {
      Toast.show({ content: '请先添加收货地址', icon: 'fail' });
      navigate('/address/edit');
      return;
    }
    const key = cardKey(activity.activityId, skuId);
    setGrabbingKey(key);
    try {
      const g = (await grabSeckill(activity.activityId, skuId)).data.data;
      if (g.status === 'pending' && g.requestId) {
        poll(g.requestId, key);
      } else if (g.status === 'grabbed') {
        setGrabbingKey(null);
        if (g.orderId) {
          // 订单已生成：直接提示并跳订单详情
          Toast.show({ content: '已抢购该商品', icon: 'info' });
          navigate(`/order/${g.orderId}`);
        } else if (g.requestId) {
          // 订单还在异步落单中：轮询找回后直达详情
          Toast.show({ content: '已抢购该商品', icon: 'info' });
          poll(g.requestId, key, true);
        } else {
          Toast.show({ content: '您已抢过该商品', icon: 'info' });
        }
      } else if (g.status === 'sold_out') {
        setGrabbingKey(null);
        Toast.show({ content: '已抢光', icon: 'fail' });
        void load();
      } else {
        setGrabbingKey(null);
        Toast.show({ content: g.message ?? '活动未开始', icon: 'fail' });
      }
    } catch (e) {
      setGrabbingKey(null);
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
  };

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>秒杀</NavBar>
      {activities.length === 0 ? (
        <div className="empty">暂无秒杀活动</div>
      ) : (
        <div className="seckill-page">
          {activities.map((activity) => (
            <div className="seckill-activity" key={activity.activityId}>
              <div className="seckill-activity-head">
                <span className="seckill-activity-name">{activity.name}</span>
                <span className="seckill-activity-time">
                  {fmtTime(activity.startTime)} ~ {fmtTime(activity.endTime)}
                </span>
              </div>
              {activity.products.length === 0 ? (
                <div className="empty">暂无秒杀商品</div>
              ) : (
                activity.products.map((p) => {
                  const key = cardKey(activity.activityId, p.skuId);
                  const orderId = won[key];
                  const busy = grabbingKey === key;
                  return (
                    <div className="seckill-card" key={p.skuId}>
                      <img className="seckill-img" src={p.productImage} alt={p.productName} />
                      <div className="seckill-card-info">
                        <div className="seckill-name">{p.productName}</div>
                        {p.skuSpec && <div className="seckill-spec">{p.skuSpec}</div>}
                        <div className="seckill-price-row">
                          <span className="seckill-price">{formatPrice(p.seckillPrice)}</span>
                          <span className="original">{formatPrice(p.originalPrice)}</span>
                        </div>
                        <div className="seckill-stock">剩余 {p.remainingStock} 件</div>
                      </div>
                      {orderId ? (
                        <Button
                          size="small"
                          color="primary"
                          onClick={() => navigate(`/order/${orderId}`)}
                        >
                          去支付
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          color="danger"
                          loading={busy}
                          disabled={
                            p.status === 'sold_out' ||
                            activity.status === 'upcoming' ||
                            grabbingKey !== null
                          }
                          onClick={() => void onGrab(activity, p.skuId)}
                        >
                          {p.status === 'sold_out'
                            ? '已抢光'
                            : activity.status === 'upcoming'
                              ? '未开始'
                              : busy
                                ? '抢购中…'
                                : '立即抢购'}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
