import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
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
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as productApi from '../../api/product';
import type { BrandRow, BrandPayload } from '../../api/product';
import { ImageUpload } from '../../components/ImageUpload';

const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

export default function BrandList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<BrandRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await productApi.listBrands({ page, pageSize, keyword: keyword || undefined });
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

  const openEdit = (row: BrandRow) => {
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
        logo: editing.logo ?? undefined,
        sort: editing.sort,
        status: editing.status,
      });
    } else {
      form.setFieldsValue({ name: undefined, logo: undefined, sort: 0, status: 1 });
    }
  }, [modalOpen, editing, form]);

  const handleSubmit = async () => {
    let values: BrandPayload;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await productApi.updateBrand(editing.id, values);
        message.success('保存成功');
      } else {
        await productApi.createBrand(values);
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

  const handleDelete = async (row: BrandRow) => {
    try {
      await productApi.deleteBrand(row.id);
      message.success('删除成功');
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const columns: ColumnsType<BrandRow> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '名称', dataIndex: 'name' },
    {
      title: 'Logo',
      dataIndex: 'logo',
      width: 90,
      render: (logo: string | null) =>
        logo ? (
          <img src={logo} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        ) : (
          '-'
        ),
    },
    { title: '排序', dataIndex: 'sort', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: number) =>
        s === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, row) => (
        <Space size="small">
          {hasPermission('brand:update') && (
            <Button size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
          )}
          {hasPermission('brand:delete') && (
            <Popconfirm title="确认删除该品牌？" onConfirm={() => handleDelete(row)}>
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
          {hasPermission('brand:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增品牌
            </Button>
          )}
        </Space>
        <Input.Search
          allowClear
          placeholder="搜索品牌名"
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
        title={editing ? '编辑品牌' : '新增品牌'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form
          key={formKey}
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? {
                  name: editing.name,
                  logo: editing.logo ?? undefined,
                  sort: editing.sort,
                  status: editing.status,
                }
              : { status: 1, sort: 0 }
          }
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入品牌名称' }]}
          >
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item name="logo" label="Logo">
            <ImageUpload />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
