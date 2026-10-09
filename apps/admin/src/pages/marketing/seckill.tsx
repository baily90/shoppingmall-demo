import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  DatePicker,
  Drawer,
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
import * as seckillApi from '../../api/seckill';
import type {
  SeckillActivityRow,
  SeckillActivityDetail,
  SeckillSkuRow,
  SkuOption,
  SeckillActivityPayload,
} from '../../api/seckill';

const yuanToCent = (yuan: number) => Math.round(yuan * 100);
const centToYuan = (cent: number) => cent / 100;
const fmtTime = (s: string) => dayjs(s).format('YYYY-MM-DD HH:mm');

const skuSpecText = (specValues: { specValue: { value: string; group: { name: string } } }[]) =>
  specValues.map((sv) => `${sv.specValue.group.name}:${sv.specValue.value}`).join(' / ');

interface ActivityFormValues {
  name: string;
  validity: [Dayjs, Dayjs];
  status: number;
}

export default function SeckillList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<SeckillActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SeckillActivityRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [form] = Form.useForm();

  // 商品配置抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerActivity, setDrawerActivity] = useState<SeckillActivityDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [skuOptions, setSkuOptions] = useState<SkuOption[]>([]);
  const [editingSkuId, setEditingSkuId] = useState<number | null>(null);
  const [skuSubmitting, setSkuSubmitting] = useState(false);
  const [skuForm] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await seckillApi.listSeckillActivities({
        page,
        pageSize,
        keyword: keyword || undefined,
      });
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
    setFormKey((k) => k + 1);
    setModalOpen(true);
  };

  const openEdit = (row: SeckillActivityRow) => {
    setEditing(row);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  };

  // 打开时显式写入表单值：form store 在切换记录间不会自动清空，必须手动同步
  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        validity: [dayjs(editing.startTime), dayjs(editing.endTime)],
        status: editing.status,
      });
    } else {
      form.setFieldsValue({ name: undefined, validity: undefined, status: 1 });
    }
  }, [modalOpen, editing, form]);

  const handleSubmit = async () => {
    let values: ActivityFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const [startTime, endTime] = values.validity;
      const payload: SeckillActivityPayload = {
        name: values.name.trim(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: values.status,
      };
      if (editing) {
        await seckillApi.updateSeckillActivity(editing.id, payload);
        message.success('保存成功');
      } else {
        await seckillApi.createSeckillActivity(payload);
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

  const handleDelete = async (row: SeckillActivityRow) => {
    try {
      await seckillApi.deleteSeckillActivity(row.id);
      message.success('删除成功');
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const loadDrawer = async (activityId: number) => {
    setDrawerLoading(true);
    try {
      const [detail, options] = await Promise.all([
        seckillApi.getSeckillActivity(activityId),
        seckillApi.getSkuOptions(),
      ]);
      setDrawerActivity(detail.data.data);
      setSkuOptions(options.data.data);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setDrawerLoading(false);
    }
  };

  const openDrawer = (row: SeckillActivityRow) => {
    setDrawerActivity(null);
    setEditingSkuId(null);
    skuForm.resetFields();
    setDrawerOpen(true);
    void loadDrawer(row.id);
  };

  const startEditSku = (row: SeckillSkuRow) => {
    setEditingSkuId(row.skuId);
    skuForm.setFieldsValue({
      skuId: row.skuId,
      seckillPrice: centToYuan(row.seckillPrice),
      seckillStock: row.seckillStock,
    });
  };

  const cancelEditSku = () => {
    setEditingSkuId(null);
    skuForm.resetFields();
  };

  const handleSaveSku = async () => {
    if (!drawerActivity) return;
    let values: { skuId?: number; seckillPrice: number; seckillStock: number };
    try {
      values = await skuForm.validateFields();
    } catch {
      return;
    }
    setSkuSubmitting(true);
    try {
      if (editingSkuId) {
        await seckillApi.updateSeckillSku(drawerActivity.id, editingSkuId, {
          seckillPrice: yuanToCent(values.seckillPrice),
          seckillStock: values.seckillStock,
        });
        message.success('保存成功');
        setEditingSkuId(null);
        skuForm.resetFields();
      } else {
        await seckillApi.addSeckillSku(drawerActivity.id, {
          skuId: values.skuId!,
          seckillPrice: yuanToCent(values.seckillPrice),
          seckillStock: values.seckillStock,
        });
        message.success('添加成功');
        skuForm.resetFields();
      }
      await loadDrawer(drawerActivity.id);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSkuSubmitting(false);
    }
  };

  const handleDeleteSku = async (row: SeckillSkuRow) => {
    if (!drawerActivity) return;
    try {
      await seckillApi.deleteSeckillSku(drawerActivity.id, row.skuId);
      message.success('移除成功');
      if (editingSkuId === row.skuId) cancelEditSku();
      await loadDrawer(drawerActivity.id);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const phaseTag = (row: SeckillActivityRow) => {
    const now = Date.now();
    const s = new Date(row.startTime).getTime();
    const e = new Date(row.endTime).getTime();
    if (now < s) return <Tag>未开始</Tag>;
    if (now >= e) return <Tag color="default">已结束</Tag>;
    return <Tag color="blue">进行中</Tag>;
  };

  const activityColumns: ColumnsType<SeckillActivityRow> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '活动名称', dataIndex: 'name', ellipsis: true },
    {
      title: '时间',
      width: 170,
      render: (_, row) => (
        <div style={{ fontSize: 12, color: '#666' }}>
          <div>{fmtTime(row.startTime)}</div>
          <div>至 {fmtTime(row.endTime)}</div>
        </div>
      ),
    },
    { title: '阶段', width: 90, render: (_, row) => phaseTag(row) },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (s: number) =>
        s === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>,
    },
    { title: '商品数', dataIndex: 'skuCount', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, row) => (
        <Space size="small">
          {hasPermission('seckill:update') && (
            <>
              <Button size="small" onClick={() => openDrawer(row)}>
                商品
              </Button>
              <Button size="small" onClick={() => openEdit(row)}>
                编辑
              </Button>
            </>
          )}
          {hasPermission('seckill:delete') && (
            <Popconfirm title="确认删除该活动？" onConfirm={() => handleDelete(row)}>
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const skuColumns: ColumnsType<SeckillSkuRow> = [
    {
      title: '商品',
      key: 'sku',
      render: (_, row) => (
        <div>
          <div>{row.sku.product.name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{skuSpecText(row.sku.specValues)}</div>
        </div>
      ),
    },
    {
      title: '秒杀价',
      dataIndex: 'seckillPrice',
      width: 100,
      render: (p: number) => `¥${centToYuan(p)}`,
    },
    { title: '秒杀库存', dataIndex: 'seckillStock', width: 90 },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, row) => (
        <Space size="small">
          {hasPermission('seckill:update') && (
            <>
              <Button size="small" onClick={() => startEditSku(row)}>
                编辑
              </Button>
              <Popconfirm title="确认移除该商品？" onConfirm={() => handleDeleteSku(row)}>
                <Button size="small" danger>
                  移除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          {hasPermission('seckill:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增活动
            </Button>
          )}
        </Space>
        <Input.Search
          allowClear
          placeholder="搜索活动名称"
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
        columns={activityColumns}
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
        title={editing ? '编辑活动' : '新增活动'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnHidden
        width={480}
      >
        <Form
          key={formKey}
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? {
                  name: editing.name,
                  validity: [dayjs(editing.startTime), dayjs(editing.endTime)],
                  status: editing.status,
                }
              : { status: 1 }
          }
        >
          <Form.Item
            name="name"
            label="活动名称"
            rules={[{ required: true, message: '请输入活动名称' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            name="validity"
            label="活动时间"
            rules={[{ required: true, message: '请选择活动时间' }]}
          >
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              style={{ width: 140 }}
              options={[
                { value: 1, label: '启用' },
                { value: 0, label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={drawerActivity ? `${drawerActivity.name} · 秒杀商品` : '秒杀商品'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
      >
        <div style={{ marginBottom: 16 }}>
          <Form form={skuForm} layout="inline" style={{ rowGap: 8 }}>
            <Form.Item
              name="skuId"
              label="商品"
              rules={[{ required: !editingSkuId, message: '请选择商品' }]}
            >
              <Select
                style={{ width: 200 }}
                showSearch
                optionFilterProp="label"
                disabled={editingSkuId !== null}
                options={skuOptions.map((o) => ({ value: o.skuId, label: o.label }))}
                placeholder="选择在售商品"
              />
            </Form.Item>
            <Form.Item
              name="seckillPrice"
              label="秒杀价(元)"
              rules={[{ required: true, message: '请输入秒杀价' }]}
            >
              <InputNumber min={0.01} precision={2} style={{ width: 110 }} />
            </Form.Item>
            <Form.Item
              name="seckillStock"
              label="库存"
              rules={[{ required: true, message: '请输入库存' }]}
            >
              <InputNumber min={1} precision={0} style={{ width: 90 }} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" loading={skuSubmitting} onClick={handleSaveSku}>
                  {editingSkuId ? '保存' : '添加'}
                </Button>
                {editingSkuId && <Button onClick={cancelEditSku}>取消</Button>}
              </Space>
            </Form.Item>
          </Form>
        </div>
        <Table
          rowKey="skuId"
          loading={drawerLoading}
          dataSource={drawerActivity?.skus ?? []}
          columns={skuColumns}
          pagination={false}
          size="small"
        />
      </Drawer>
    </>
  );
}
