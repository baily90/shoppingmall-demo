import { useCallback, useEffect, useState } from 'react';
import { App, Button, Descriptions, Drawer, Input, Rate, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as reviewApi from '../../api/review';
import type { ReviewRow } from '../../api/review';
import { REVIEW_RATING_OPTIONS, REVIEW_STATUS, REVIEW_STATUS_OPTIONS } from '../../api/review';

export default function ReviewList() {
  const { message, modal } = App.useApp();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<ReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<number | undefined>();
  const [filterRating, setFilterRating] = useState<number | undefined>();

  const [detail, setDetail] = useState<ReviewRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await reviewApi.listReviews({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: filterStatus,
        rating: filterRating,
      });
      setData(res.data.data.list);
      setTotal(res.data.data.total);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize, keyword, filterStatus, filterRating]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = (row: ReviewRow) => {
    const next = row.status === 1 ? 0 : 1;
    const actionText = next === 0 ? '屏蔽' : '恢复';
    modal.confirm({
      title: `${actionText}评价？`,
      content:
        next === 0
          ? '屏蔽后该评价将从商品页隐藏，并同步扣减商品评分'
          : '恢复后该评价将重新展示，并同步计入商品评分',
      onOk: async () => {
        try {
          await reviewApi.setReviewStatus(row.id, next);
          message.success(`已${actionText}`);
          await load();
        } catch (e) {
          message.error(getErrorMessage(e));
        }
      },
    });
  };

  const columns: ColumnsType<ReviewRow> = [
    {
      title: '商品',
      width: 220,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {row.product?.mainImage && (
            <img
              src={row.product.mainImage}
              alt=""
              style={{ width: 40, height: 40, objectFit: 'contain' }}
            />
          )}
          <span>{row.product?.name ?? '-'}</span>
        </div>
      ),
    },
    {
      title: '评分',
      dataIndex: 'rating',
      width: 130,
      render: (v: number) => <Rate disabled value={v} />,
    },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
      render: (v: string | null) => v ?? <span style={{ color: '#bbb' }}>（无文字）</span>,
    },
    {
      title: '图片',
      dataIndex: 'images',
      width: 120,
      render: (images: string[] | null) =>
        images?.length ? (
          <Space size={4} wrap>
            {images.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt=""
                style={{ width: 40, height: 40, objectFit: 'contain' }}
              />
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '匿名',
      dataIndex: 'anonymous',
      width: 70,
      render: (v: boolean) => (v ? '是' : '否'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: number) => (
        <Tag color={REVIEW_STATUS[s]?.color}>{REVIEW_STATUS[s]?.text ?? s}</Tag>
      ),
    },
    {
      title: '用户',
      width: 140,
      render: (_, row) => (
        <div>
          <div>{row.user?.nickname ?? '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{row.user?.phone}</div>
        </div>
      ),
    },
    {
      title: '订单号',
      dataIndex: 'order',
      width: 180,
      render: (order: ReviewRow['order']) => order?.orderNo ?? '-',
    },
    {
      title: '评价时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => v.slice(0, 19).replace('T', ' '),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, row) => (
        <Space size="small">
          <Button size="small" onClick={() => setDetail(row)}>
            详情
          </Button>
          {hasPermission('review:block') && (
            <Button size="small" danger={row.status === 1} onClick={() => handleToggle(row)}>
              {row.status === 1 ? '屏蔽' : '恢复'}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="评价状态"
          style={{ width: 140 }}
          options={REVIEW_STATUS_OPTIONS}
          value={filterStatus}
          onChange={(v) => {
            setPage(1);
            setFilterStatus(v);
          }}
        />
        <Select
          allowClear
          placeholder="评分"
          style={{ width: 120 }}
          options={REVIEW_RATING_OPTIONS}
          value={filterRating}
          onChange={(v) => {
            setPage(1);
            setFilterRating(v);
          }}
        />
        <Input.Search
          allowClear
          placeholder="搜索评价内容"
          style={{ width: 260 }}
          onSearch={(v) => {
            setPage(1);
            setKeyword(v.trim());
          }}
        />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Drawer
        title="评价详情"
        width={560}
        open={!!detail}
        onClose={() => setDetail(null)}
        destroyOnHidden
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="商品">{detail.product?.name ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="评分">
              <Rate disabled value={detail.rating} />
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={REVIEW_STATUS[detail.status]?.color}>
                {REVIEW_STATUS[detail.status]?.text ?? detail.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="匿名">{detail.anonymous ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="用户">
              {detail.user?.nickname}（{detail.user?.phone}）
            </Descriptions.Item>
            <Descriptions.Item label="订单">{detail.order?.orderNo}</Descriptions.Item>
            <Descriptions.Item label="内容">{detail.content ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="图片">
              {detail.images?.length ? (
                <Space size={8} wrap>
                  {detail.images.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt=""
                      style={{ width: 80, height: 80, objectFit: 'contain' }}
                    />
                  ))}
                </Space>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="评价时间">
              {detail.createdAt.slice(0, 19).replace('T', ' ')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  );
}
