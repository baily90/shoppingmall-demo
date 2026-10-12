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
  Tabs,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import { ImageUpload } from '../../components/ImageUpload';
import * as homeApi from '../../api/home';
import type { HomeSlotRow, HomeSlotPayload } from '../../api/home';
import { HOME_LINK_TYPE, HOME_SLOT_STATUS } from '../../api/home';

const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '停用' },
];

const LINK_TYPE_OPTIONS = Object.entries(HOME_LINK_TYPE).map(([value, label]) => ({
  value: Number(value),
  label,
}));

/** 跳转值占位提示：不同 linkType 对应不同取值含义 */
function linkValuePlaceholder(linkType: number): string {
  switch (linkType) {
    case 1:
      return '商品 ID';
    case 2:
      return '分类 ID';
    case 4:
      return 'https://…';
    default:
      return '无需填写';
  }
}

const needsLinkValue = (linkType: number) => linkType === 1 || linkType === 2 || linkType === 4;

interface HomeFormValues {
  name: string;
  image: string;
  linkType: number;
  linkValue?: string;
  sort: number;
  status: number;
}

export default function HomeSlotList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  const [activeType, setActiveType] = useState<1 | 2>(1);
  const [data, setData] = useState<HomeSlotRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HomeSlotRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [form] = Form.useForm();
  const [linkType, setLinkType] = useState<number>(0);

  const load = useCallback(async () => {
    try {
      const res = await homeApi.listHomeSlots({ page, pageSize, type: activeType });
      setData(res.data.data.list);
      setTotal(res.data.data.total);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize, activeType]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setLinkType(0);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  };

  const openEdit = (row: HomeSlotRow) => {
    setEditing(row);
    setLinkType(row.linkType);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        image: editing.image,
        linkType: editing.linkType,
        linkValue: editing.linkValue ?? undefined,
        sort: editing.sort,
        status: editing.status,
      });
    } else {
      form.setFieldsValue({
        name: undefined,
        image: undefined,
        linkType: 0,
        linkValue: undefined,
        sort: 0,
        status: 1,
      });
    }
  }, [modalOpen, editing, form]);

  const handleSubmit = async () => {
    let values: HomeFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const payload: Omit<HomeSlotPayload, 'type'> = {
        name: values.name.trim(),
        image: values.image,
        linkType: values.linkType ?? 0,
        sort: values.sort ?? 0,
        status: values.status ?? 1,
      };
      if (needsLinkValue(values.linkType)) {
        payload.linkValue = values.linkValue?.trim() || undefined;
      } else {
        payload.linkValue = undefined;
      }
      if (editing) {
        // type 是装修位的固有属性（轮播图/金刚区由所在 Tab 决定），编辑时不改也不传
        await homeApi.updateHomeSlot(editing.id, payload);
        message.success('保存成功');
      } else {
        await homeApi.createHomeSlot({ ...payload, type: activeType });
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

  const handleDelete = async (row: HomeSlotRow) => {
    try {
      await homeApi.deleteHomeSlot(row.id);
      message.success('删除成功');
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const columns: ColumnsType<HomeSlotRow> = [
    {
      title: '图片',
      dataIndex: 'image',
      width: 90,
      render: (url: string) => (
        <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
      ),
    },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '跳转',
      width: 180,
      render: (_, row) => (
        <span>
          {HOME_LINK_TYPE[row.linkType] ?? row.linkType}
          {row.linkValue ? `（${row.linkValue}）` : ''}
        </span>
      ),
    },
    { title: '排序', dataIndex: 'sort', width: 70 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (s: number) => (
        <Tag color={HOME_SLOT_STATUS[s]?.color}>{HOME_SLOT_STATUS[s]?.text ?? s}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, row) => (
        <Space size="small">
          {hasPermission('home:update') && (
            <Button size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
          )}
          {hasPermission('home:delete') && (
            <Popconfirm title="确认删除该装修位？" onConfirm={() => handleDelete(row)}>
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
      <Tabs
        activeKey={String(activeType)}
        onChange={(key) => {
          setPage(1);
          setActiveType(Number(key) as 1 | 2);
        }}
        items={[
          { key: '1', label: '轮播图' },
          { key: '2', label: '金刚区图标' },
        ]}
        tabBarExtraContent={
          hasPermission('home:create') ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增
            </Button>
          ) : null
        }
      />

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
        title={editing ? '编辑装修位' : '新增装修位'}
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
                  image: editing.image,
                  linkType: editing.linkType,
                  linkValue: editing.linkValue ?? undefined,
                  sort: editing.sort,
                  status: editing.status,
                }
              : { linkType: 0, sort: 0, status: 1 }
          }
        >
          <Form.Item
            name="name"
            label={activeType === 1 ? '标题' : '图标名'}
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input maxLength={30} />
          </Form.Item>

          <Form.Item name="image" label="图片" rules={[{ required: true, message: '请上传图片' }]}>
            <ImageUpload />
          </Form.Item>

          <Space size="large" style={{ display: 'flex' }} align="start">
            <Form.Item name="linkType" label="跳转类型" initialValue={0}>
              <Select
                style={{ width: 160 }}
                options={LINK_TYPE_OPTIONS}
                onChange={(v) => setLinkType(v)}
              />
            </Form.Item>
            {needsLinkValue(linkType) && (
              <Form.Item
                name="linkValue"
                label="跳转值"
                rules={[{ required: true, message: '请输入跳转值' }]}
              >
                <Input placeholder={linkValuePlaceholder(linkType)} style={{ width: 200 }} />
              </Form.Item>
            )}
          </Space>

          <Space size="large" style={{ display: 'flex' }} align="start">
            <Form.Item name="sort" label="排序" extra="越小越靠前">
              <InputNumber min={0} precision={0} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select style={{ width: 140 }} options={STATUS_OPTIONS} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
