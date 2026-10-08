import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as couponApi from '../../api/coupon';
import type { CouponRow, CouponPayload } from '../../api/coupon';

const TYPE_OPTIONS = [
  { value: 1, label: '满减' },
  { value: 2, label: '折扣' },
];

const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '停用' },
];

// 分 <-> 元 换算（后端统一用「分」存储金额）
const yuanToCent = (yuan: number) => Math.round(yuan * 100);
const centToYuan = (cent: number) => cent / 100;
const yuanText = (cent: number) => String(cent / 100);

// 优惠内容一句话摘要
function couponBrief(c: CouponRow): string {
  const threshold = c.thresholdAmount > 0 ? `满${yuanText(c.thresholdAmount)}元` : '无门槛';
  if (c.type === 1) return `${threshold}减${yuanText(c.discountAmount)}元`;
  return `${threshold}${c.discountRate / 10}折`;
}

const fmtTime = (s: string) => dayjs(s).format('YYYY-MM-DD HH:mm');

interface CouponFormValues {
  name: string;
  type: number;
  thresholdAmount?: number;
  discountAmount?: number;
  discountRate?: number;
  totalStock?: number;
  perUserLimit?: number;
  validity: [Dayjs, Dayjs];
  status: number;
  description?: string;
}

export default function CouponList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<CouponRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [form] = Form.useForm();
  // 用于控制「满减/折扣」条件字段的显隐
  const [couponType, setCouponType] = useState<number>(1);

  const load = useCallback(async () => {
    try {
      const res = await couponApi.listCoupons({ page, pageSize, keyword: keyword || undefined });
      setData(res.data.data.list);
      setTotal(res.data.data.total);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize, keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setCouponType(1);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  };

  const openEdit = (row: CouponRow) => {
    setEditing(row);
    setCouponType(row.type);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  };

  // 打开时显式写入表单值：form store 在切换记录间不会自动清空，必须手动同步
  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        type: editing.type,
        thresholdAmount: centToYuan(editing.thresholdAmount),
        discountAmount: editing.type === 1 ? centToYuan(editing.discountAmount) : undefined,
        discountRate: editing.type === 2 ? editing.discountRate : undefined,
        perUserLimit: editing.perUserLimit,
        validity: [dayjs(editing.startTime), dayjs(editing.endTime)],
        status: editing.status,
        description: editing.description ?? undefined,
      });
    } else {
      form.setFieldsValue({
        name: undefined,
        type: 1,
        thresholdAmount: undefined,
        discountAmount: undefined,
        discountRate: undefined,
        totalStock: undefined,
        perUserLimit: 1,
        status: 1,
        description: undefined,
      });
    }
  }, [modalOpen, editing, form]);

  const handleSubmit = async () => {
    let values: CouponFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const [startTime, endTime] = values.validity;
      const payload: CouponPayload = {
        name: values.name.trim(),
        type: values.type,
        thresholdAmount: values.thresholdAmount != null ? yuanToCent(values.thresholdAmount) : 0,
        perUserLimit: values.perUserLimit ?? 0,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: values.status,
        description: values.description?.trim() || undefined,
      };
      if (values.type === 1) {
        payload.discountAmount = yuanToCent(values.discountAmount ?? 0);
      } else {
        payload.discountRate = values.discountRate;
      }
      if (editing) {
        await couponApi.updateCoupon(editing.id, payload);
        message.success('保存成功');
      } else {
        payload.totalStock = values.totalStock;
        await couponApi.createCoupon(payload);
        message.success('新增成功');
      }
      setModalOpen(false);
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: CouponRow) => {
    try {
      await couponApi.deleteCoupon(row.id);
      message.success('删除成功');
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const columns: ColumnsType<CouponRow> = [
    { title: 'ID', dataIndex: 'id', width: 64 },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (t: number) =>
        t === 1 ? <Tag color="blue">满减</Tag> : <Tag color="purple">折扣</Tag>,
    },
    { title: '优惠内容', width: 150, render: (_, row) => couponBrief(row) },
    {
      title: '领取',
      width: 100,
      render: (_, row) => (
        <span>
          {row.receivedCount}/{row.totalStock}
        </span>
      ),
    },
    {
      title: '每人限领',
      dataIndex: 'perUserLimit',
      width: 90,
      render: (n: number) => (n === 0 ? '不限' : n),
    },
    {
      title: '有效期',
      width: 170,
      render: (_, row) => (
        <div style={{ fontSize: 12, color: '#666' }}>
          <div>{fmtTime(row.startTime)}</div>
          <div>至 {fmtTime(row.endTime)}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (s: number) =>
        s === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, row) => (
        <Space size="small">
          {hasPermission('coupon:update') && (
            <Button size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
          )}
          {hasPermission('coupon:delete') && (
            <Popconfirm title="确认删除该优惠券？" onConfirm={() => handleDelete(row)}>
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          {hasPermission('coupon:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增优惠券
            </Button>
          )}
        </Space>
        <Input.Search
          allowClear
          placeholder="搜索券名称"
          style={{ width: 240 }}
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

      <Modal
        title={editing ? '编辑优惠券' : '新增优惠券'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnHidden
        width={520}
      >
        <Form
          key={formKey}
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? {
                  name: editing.name,
                  type: editing.type,
                  thresholdAmount: centToYuan(editing.thresholdAmount),
                  discountAmount:
                    editing.type === 1 ? centToYuan(editing.discountAmount) : undefined,
                  discountRate: editing.type === 2 ? editing.discountRate : undefined,
                  perUserLimit: editing.perUserLimit,
                  validity: [dayjs(editing.startTime), dayjs(editing.endTime)],
                  status: editing.status,
                  description: editing.description ?? undefined,
                }
              : { type: 1, perUserLimit: 1, status: 1 }
          }
        >
          <Form.Item
            name="name"
            label="券名称"
            rules={[{ required: true, message: '请输入券名称' }]}
          >
            <Input maxLength={50} />
          </Form.Item>

          <Space size="large" style={{ display: 'flex' }} align="start">
            <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
              <Select
                style={{ width: 140 }}
                options={TYPE_OPTIONS}
                onChange={(v) => setCouponType(v)}
              />
            </Form.Item>
            <Form.Item
              name="thresholdAmount"
              label="使用门槛"
              extra="0 表示无门槛"
              initialValue={0}
            >
              <InputNumber min={0} precision={2} addonAfter="元" style={{ width: 180 }} />
            </Form.Item>
          </Space>

          {couponType === 1 ? (
            <Form.Item
              name="discountAmount"
              label="减免金额"
              rules={[{ required: true, message: '请输入减免金额' }]}
            >
              <InputNumber min={0.01} precision={2} addonAfter="元" style={{ width: 180 }} />
            </Form.Item>
          ) : (
            <Form.Item
              name="discountRate"
              label="折扣率"
              extra="填 85 表示打 8.5 折（1~99）"
              rules={[{ required: true, message: '请输入折扣率' }]}
            >
              <InputNumber min={1} max={99} precision={0} style={{ width: 180 }} />
            </Form.Item>
          )}

          <Space size="large" style={{ display: 'flex' }} align="start">
            {!editing && (
              <Form.Item
                name="totalStock"
                label="发行量"
                rules={[{ required: true, message: '请输入发行量' }]}
              >
                <InputNumber min={1} precision={0} style={{ width: 140 }} />
              </Form.Item>
            )}
            <Form.Item name="perUserLimit" label="每人限领" extra="0 表示不限">
              <InputNumber min={0} precision={0} style={{ width: 140 }} />
            </Form.Item>
          </Space>

          <Form.Item
            name="validity"
            label="有效期"
            rules={[{ required: true, message: '请选择有效期' }]}
          >
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Space size="large" style={{ display: 'flex' }} align="start">
            <Form.Item name="status" label="状态">
              <Select style={{ width: 140 }} options={STATUS_OPTIONS} />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} maxLength={200} placeholder="使用说明（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
