import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as refundApi from '../../api/refund';
import type { RefundRow, RefundDetail } from '../../api/refund';
import { REFUND_STATUS, REFUND_STATUS_OPTIONS, REFUND_TYPE_TEXT } from '../../api/refund';
import type { OrderItemRow } from '../../api/order';

const centToYuan = (cent: number) => (cent / 100).toFixed(2);

export default function RefundList() {
  const { message, modal } = App.useApp();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<RefundRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<number | undefined>();

  const [detail, setDetail] = useState<RefundDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<RefundRow | null>(null);
  const [reviewApprove, setReviewApprove] = useState(true);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await refundApi.listRefunds({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: filterStatus,
      });
      setData(res.data.data.list);
      setTotal(res.data.data.total);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize, keyword, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (row: RefundRow) => {
    try {
      const res = await refundApi.getRefund(row.id);
      setDetail(res.data.data);
      setDetailOpen(true);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const openReview = (row: RefundRow) => {
    setReviewTarget(row);
    setReviewApprove(true);
    setReviewReason('');
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    if (!reviewApprove && !reviewReason.trim()) {
      message.error('请填写拒绝原因');
      return;
    }
    setReviewSubmitting(true);
    try {
      await refundApi.reviewRefund(reviewTarget.id, {
        approve: reviewApprove,
        rejectReason: reviewReason.trim() || undefined,
      });
      message.success(reviewApprove ? '已同意' : '已拒绝');
      setReviewTarget(null);
      await load();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleConfirmReceipt = (row: RefundRow) => {
    modal.confirm({
      title: '确认收货并退款？',
      content: '确认买家已退货，将执行退款并回补库存',
      onOk: async () => {
        try {
          await refundApi.confirmReceiptRefund(row.id);
          message.success('退款成功');
          await load();
        } catch (e) {
          message.error(getErrorMessage(e));
        }
      },
    });
  };

  const columns: ColumnsType<RefundRow> = [
    { title: '退款单号', dataIndex: 'refundNo', width: 200 },
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
    { title: '类型', dataIndex: 'type', width: 90, render: (v: number) => REFUND_TYPE_TEXT[v] },
    {
      title: '金额(元)',
      dataIndex: 'amount',
      width: 110,
      render: (v: number) => `¥${centToYuan(v)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (s: number) => (
        <Tag color={REFUND_STATUS[s]?.color}>{REFUND_STATUS[s]?.text ?? s}</Tag>
      ),
    },
    { title: '申请原因', dataIndex: 'reason', ellipsis: true },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => v.slice(0, 19).replace('T', ' '),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, row) => (
        <Space size="small">
          <Button size="small" onClick={() => void openDetail(row)}>
            详情
          </Button>
          {row.status === 10 && hasPermission('aftersale:review') && (
            <Button size="small" type="primary" onClick={() => openReview(row)}>
              审核
            </Button>
          )}
          {row.status === 30 && hasPermission('aftersale:review') && (
            <Button size="small" type="primary" danger onClick={() => handleConfirmReceipt(row)}>
              确认收货退款
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const itemColumns: ColumnsType<OrderItemRow> = [
    {
      title: '商品',
      dataIndex: 'productName',
      render: (name: string, r) => (
        <div>
          <div>{name}</div>
          {r.skuSpec && <div style={{ color: '#999', fontSize: 12 }}>{r.skuSpec}</div>}
        </div>
      ),
    },
    {
      title: '单价(元)',
      dataIndex: 'price',
      width: 100,
      render: (v: number) => `¥${centToYuan(v)}`,
    },
    { title: '数量', dataIndex: 'quantity', width: 70 },
    {
      title: '小计(元)',
      dataIndex: 'totalAmount',
      width: 100,
      render: (v: number) => `¥${centToYuan(v)}`,
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="售后状态"
          style={{ width: 160 }}
          options={REFUND_STATUS_OPTIONS}
          value={filterStatus}
          onChange={(v) => {
            setPage(1);
            setFilterStatus(v);
          }}
        />
        <Input.Search
          allowClear
          placeholder="搜索退款单号"
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
        title="售后详情"
        width={640}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnHidden
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="退款单号">{detail.refundNo}</Descriptions.Item>
            <Descriptions.Item label="类型">{REFUND_TYPE_TEXT[detail.type]}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={REFUND_STATUS[detail.status]?.color}>
                {REFUND_STATUS[detail.status]?.text ?? detail.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="用户">
              {detail.user?.nickname}（{detail.user?.phone}）
            </Descriptions.Item>
            <Descriptions.Item label="关联订单">{detail.order?.orderNo}</Descriptions.Item>
            <Descriptions.Item label="退款金额">¥{centToYuan(detail.amount)}</Descriptions.Item>
            <Descriptions.Item label="申请原因">{detail.reason}</Descriptions.Item>
            <Descriptions.Item label="补充说明">{detail.description ?? '-'}</Descriptions.Item>
            {detail.rejectReason && (
              <Descriptions.Item label="拒绝原因">{detail.rejectReason}</Descriptions.Item>
            )}
            <Descriptions.Item label="退货物流">
              {detail.logisticsCompany ? `${detail.logisticsCompany} ${detail.logisticsNo}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="申请时间">
              {detail.createdAt.slice(0, 19).replace('T', ' ')}
            </Descriptions.Item>
          </Descriptions>
        )}

        {detail && (
          <Table
            style={{ marginTop: 16 }}
            rowKey="id"
            size="small"
            dataSource={detail.order.items}
            columns={itemColumns}
            pagination={false}
          />
        )}
      </Drawer>

      <Modal
        title="售后审核"
        open={!!reviewTarget}
        onOk={() => void handleReview()}
        onCancel={() => setReviewTarget(null)}
        confirmLoading={reviewSubmitting}
        destroyOnHidden
      >
        <Radio.Group
          value={reviewApprove}
          onChange={(e) => setReviewApprove(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          <Radio value={true}>同意</Radio>
          <Radio value={false}>拒绝</Radio>
        </Radio.Group>
        {!reviewApprove && (
          <Input.TextArea
            placeholder="请填写拒绝原因"
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            maxLength={200}
            rows={3}
          />
        )}
      </Modal>
    </>
  );
}
