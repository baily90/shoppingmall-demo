import { useCallback, useEffect, useMemo, useState } from 'react';
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
  TreeSelect,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as productApi from '../../api/product';
import type { CategoryNode, CategoryPayload } from '../../api/product';
import { ImageUpload } from '../../components/ImageUpload';

const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

interface ParentTreeNode {
  value: number;
  title: string;
  children: ParentTreeNode[];
}

// 分类最多两级：只有一级分类能作为父级，子级不再放进可选列表
function toParentTree(nodes: CategoryNode[]): ParentTreeNode[] {
  return nodes.map((n) => ({ value: n.id, title: n.name, children: [] }));
}

// rc-table 用真值判断「是否有子级」，空数组 [] 也会被当成有子级而画展开图标；
// 把叶子节点的 children 置为 undefined（假值），二级分类就不再显示展开/收起按钮
function pruneEmptyChildren(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.map((n) => ({
    ...n,
    children: n.children.length
      ? pruneEmptyChildren(n.children)
      : (undefined as unknown as CategoryNode[]),
  }));
}

export default function CategoryList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryNode | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await productApi.listCategories();
      setData(pruneEmptyChildren(res.data.data));
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  const parentTree = useMemo(() => toParentTree(data), [data]);

  const openCreate = (parentId: number | null) => {
    setEditing(null);
    setDefaultParentId(parentId);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  };

  const openEdit = (node: CategoryNode) => {
    setEditing(node);
    setDefaultParentId(node.parentId ?? null);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  };

  // 打开时显式写入表单值：form store 在切换记录间不会自动清空，必须手动同步
  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        parentId: editing.parentId ?? undefined,
        name: editing.name,
        icon: editing.icon ?? undefined,
        sort: editing.sort,
        status: editing.status,
      });
    } else {
      form.setFieldsValue({
        parentId: defaultParentId ?? undefined,
        name: undefined,
        icon: undefined,
        sort: 0,
        status: 1,
      });
    }
  }, [modalOpen, editing, defaultParentId, form]);

  const handleSubmit = async () => {
    let values: CategoryPayload;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await productApi.updateCategory(editing.id, values);
        message.success('保存成功');
      } else {
        await productApi.createCategory(values);
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

  const handleDelete = async (node: CategoryNode) => {
    try {
      await productApi.deleteCategory(node.id);
      message.success('删除成功');
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const columns: ColumnsType<CategoryNode> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (name: string, row) => (
        <Space>
          <span>{name}</span>
          <Tag color="blue">L{row.level}</Tag>
        </Space>
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
      title: '图标',
      dataIndex: 'icon',
      width: 80,
      render: (icon: string | null) =>
        icon ? (
          <img src={icon} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, row) => (
        <Space size="small">
          {hasPermission('category:create') && row.level < 2 && (
            <Button size="small" type="link" onClick={() => openCreate(row.id)}>
              新增子级
            </Button>
          )}
          {hasPermission('category:update') && (
            <Button size="small" type="link" onClick={() => openEdit(row)}>
              编辑
            </Button>
          )}
          {hasPermission('category:delete') && (
            <Popconfirm title="确认删除该分类？" onConfirm={() => handleDelete(row)}>
              <Button size="small" type="link" danger>
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
      <Space style={{ marginBottom: 16 }}>
        {hasPermission('category:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(null)}>
            新增分类
          </Button>
        )}
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={false}
        expandable={{ defaultExpandAllRows: true }}
      />

      <Modal
        title={editing ? '编辑分类' : '新增分类'}
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
                  parentId: editing.parentId ?? undefined,
                  name: editing.name,
                  icon: editing.icon ?? undefined,
                  sort: editing.sort,
                  status: editing.status,
                }
              : { parentId: defaultParentId ?? undefined, status: 1, sort: 0 }
          }
        >
          <Form.Item name="parentId" label="父级分类">
            <TreeSelect allowClear={!editing} treeData={parentTree} placeholder="不选则为顶级" />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item name="icon" label="图标">
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
