import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as orderApi from '../../api/order';
import type { OrderItemRow, OrderRow } from '../../api/order';
import { ORDER_STATUS, ORDER_STATUS_OPTIONS } from '../../api/order';

// 分 -> 元（后端统一用「分」存储金额）
const centToYuan = (cent: number) => (cent / 100).toFixed(2);

export default function OrderList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<number | undefined>();

  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [shipTarget, setShipTarget] = useState<OrderRow | null>(null);
  const [shipSubmitting, setShipSubmitting] = useState(false);
  const [shipForm] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await orderApi.listOrders({
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

  const openDetail = async (row: OrderRow) => {
    try {
      const res = await orderApi.getOrder(row.id);
      setDetail(res.data.data);
      setDetailOpen(true);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const openShip = (row: OrderRow) => {
    setShipTarget(row);
    shipForm.setFieldsValue({ logisticsCompany: '', logisticsNo: '' });
  };

  const handleShip = async () => {
    let values: { logisticsCompany: string; logisticsNo: string };
    try {
      values = await shipForm.validateFields();
    } catch {
      return;
    }
    if (!shipTarget) return;
    setShipSubmitting(true);
    try {
      await orderApi.shipOrder(shipTarget.id, values);
      message.success('发货成功');
      setShipTarget(null);
      await load();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setShipSubmitting(false);
    }
  };

  const columns: ColumnsType<OrderRow> = [
    { title: '订单号', dataIndex: 'orderNo', width: 210 },
    {
      title: '用户',
      width: 150,
      render: (_, row) => (
        <div>
          <div>{row.user?.nickname ?? '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{row.user?.phone}</div>
        </div>
      ),
    },
    {
      title: '商品',
      render: (_, row) => {
        const count = row.items.reduce((s, i) => s + i.quantity, 0);
        return `${row.items[0]?.productName ?? '-'}${count > 1 ? ` 等 ${count} 件` : ''}`;
      },
    },
    {
      title: '实付(元)',
      dataIndex: 'payAmount',
      width: 110,
      render: (v: number) => `¥${centToYuan(v)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: number) => <Tag color={ORDER_STATUS[s]?.color}>{ORDER_STATUS[s]?.text ?? s}</Tag>,
    },
    {
      title: '收货人',
      width: 140,
      render: (_, row) => `${row.receiverName} ${row.receiverPhone}`,
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => v.slice(0, 19).replace('T', ' '),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, row) => (
        <Space size="small">
          <Button size="small" onClick={() => void openDetail(row)}>
            详情
          </Button>
          {row.status === 20 && hasPermission('order:ship') && (
            <Button size="small" type="primary" onClick={() => openShip(row)}>
              发货
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
          placeholder="订单状态"
          style={{ width: 140 }}
          options={ORDER_STATUS_OPTIONS}
          value={filterStatus}
          onChange={(v) => {
            setPage(1);
            setFilterStatus(v);
          }}
        />
        <Input.Search
          allowClear
          placeholder="搜索订单号"
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
        title="订单详情"
        width={640}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnHidden
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="订单号">{detail.orderNo}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={ORDER_STATUS[detail.status]?.color}>
                {ORDER_STATUS[detail.status]?.text ?? detail.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="用户">
              {detail.user?.nickname}（{detail.user?.phone}）
            </Descriptions.Item>
            <Descriptions.Item label="收货人">
              {detail.receiverName} {detail.receiverPhone}
            </Descriptions.Item>
            <Descriptions.Item label="收货地址">{detail.receiverAddress}</Descriptions.Item>
            <Descriptions.Item label="备注">{detail.remark ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="物流">
              {detail.logisticsCompany ? `${detail.logisticsCompany} ${detail.logisticsNo}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="商品金额">
              ¥{centToYuan(detail.totalAmount)}
            </Descriptions.Item>
            {detail.discountAmount > 0 && (
              <Descriptions.Item label="优惠券">
                -¥{centToYuan(detail.discountAmount)}
                {detail.userCoupon?.coupon?.name ? `（${detail.userCoupon.coupon.name}）` : ''}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="运费">¥{centToYuan(detail.freightAmount)}</Descriptions.Item>
            <Descriptions.Item label="实付">¥{centToYuan(detail.payAmount)}</Descriptions.Item>
            <Descriptions.Item label="下单时间">
              {detail.createdAt.slice(0, 19).replace('T', ' ')}
            </Descriptions.Item>
          </Descriptions>
        )}

        {detail && (
          <Table
            style={{ marginTop: 16 }}
            rowKey="id"
            size="small"
            dataSource={detail.items}
            columns={itemColumns}
            pagination={false}
          />
        )}
      </Drawer>

      <Modal
        title="订单发货"
        open={!!shipTarget}
        onOk={() => void handleShip()}
        onCancel={() => setShipTarget(null)}
        confirmLoading={shipSubmitting}
        destroyOnHidden
      >
        <Form form={shipForm} layout="vertical">
          <Form.Item
            name="logisticsCompany"
            label="物流公司"
            rules={[{ required: true, message: '请输入物流公司' }]}
          >
            <Input maxLength={50} placeholder="如 顺丰速运" />
          </Form.Item>
          <Form.Item
            name="logisticsNo"
            label="物流单号"
            rules={[{ required: true, message: '请输入物流单号' }]}
          >
            <Input maxLength={50} placeholder="如 SF123456789" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
