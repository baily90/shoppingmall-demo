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
  Spin,
  Tag,
  Tree,
  TreeSelect,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as systemApi from '../../api/system';
import type { CreatePermissionPayload } from '../../api/system';
import type { MenuNode } from '../../api/auth';

const TYPE_LABEL: Record<number, string> = { 1: '目录', 2: '菜单', 3: '按钮' };
const TYPE_COLOR: Record<number, string> = { 1: 'purple', 2: 'blue', 3: 'default' };
const TYPE_OPTIONS = [
  { value: 1, label: '目录' },
  { value: 2, label: '菜单' },
  { value: 3, label: '按钮' },
];
const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

interface ParentNode {
  value: number;
  title: string;
  children: ParentNode[];
}

// 父级只能选目录/菜单（按钮不能作为父级）
function toParentTree(nodes: MenuNode[]): ParentNode[] {
  return nodes
    .filter((n) => n.type !== 3)
    .map((n) => ({ value: n.id, title: n.name, children: toParentTree(n.children) }));
}

function toTreeData(nodes: MenuNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: n.name,
    children: n.children.length ? toTreeData(n.children) : undefined,
  }));
}

export default function PermissionList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  const [perms, setPerms] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuNode | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await systemApi.listPermissions();
      setPerms(res.data.data);
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

  const treeData = useMemo(() => toTreeData(perms), [perms]);
  const parentTreeData = useMemo(() => toParentTree(perms), [perms]);

  const idMap = useMemo(() => {
    const map = new Map<number, MenuNode>();
    const walk = (nodes: MenuNode[]) => {
      nodes.forEach((n) => {
        map.set(n.id, n);
        walk(n.children);
      });
    };
    walk(perms);
    return map;
  }, [perms]);

  const openCreate = (parentId: number | null) => {
    setEditing(null);
    setDefaultParentId(parentId);
    setModalOpen(true);
  };

  const openEdit = (node: MenuNode) => {
    setEditing(node);
    setDefaultParentId(node.parentId ?? null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    let values: CreatePermissionPayload;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await systemApi.updatePermission(editing.id, values);
        message.success('保存成功');
      } else {
        await systemApi.createPermission(values);
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

  const handleDelete = async (node: MenuNode) => {
    try {
      await systemApi.deletePermission(node.id);
      message.success('删除成功');
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const renderTitle = (n: MenuNode) => (
    <Space>
      <span>{n.name}</span>
      <Tag color={TYPE_COLOR[n.type]}>{TYPE_LABEL[n.type]}</Tag>
      <span style={{ color: '#999', fontSize: 12 }}>{n.code}</span>
      {n.type !== 3 && hasPermission('permission:create') && (
        <Button
          size="small"
          type="link"
          onClick={(e) => {
            e.stopPropagation();
            openCreate(n.id);
          }}
        >
          新增子级
        </Button>
      )}
      {hasPermission('permission:update') && (
        <Button
          size="small"
          type="link"
          onClick={(e) => {
            e.stopPropagation();
            openEdit(n);
          }}
        >
          编辑
        </Button>
      )}
      {hasPermission('permission:delete') && (
        <Popconfirm title="确认删除该权限？" onConfirm={() => handleDelete(n)}>
          <Button size="small" type="link" danger onClick={(e) => e.stopPropagation()}>
            删除
          </Button>
        </Popconfirm>
      )}
    </Space>
  );

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        {hasPermission('permission:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(null)}>
            新增权限
          </Button>
        )}
      </Space>

      <Spin spinning={loading}>
        <Tree
          showLine
          defaultExpandAll
          treeData={treeData}
          titleRender={(node) => {
            const n = idMap.get(Number(node.key));
            return n ? renderTitle(n) : null;
          }}
        />
      </Spin>

      <Modal
        title={editing ? '编辑权限' : '新增权限'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? {
                  parentId: editing.parentId ?? undefined,
                  type: editing.type,
                  name: editing.name,
                  code: editing.code,
                  path: editing.path,
                  icon: editing.icon,
                  sort: editing.sort,
                  status: editing.status,
                }
              : { parentId: defaultParentId ?? undefined, type: 2, status: 1, sort: 0 }
          }
        >
          <Form.Item name="parentId" label="父级">
            <TreeSelect
              allowClear={!editing}
              treeData={parentTreeData}
              placeholder="不选则为顶级"
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item
            name="code"
            label="权限码"
            rules={[
              { required: true, message: '请输入权限码' },
              { pattern: /^[a-z][a-z0-9:_-]*$/, message: '小写字母开头，字母/数字/:_-' },
            ]}
          >
            <Input maxLength={50} placeholder="如 user:create" />
          </Form.Item>
          <Form.Item name="path" label="路由路径">
            <Input placeholder="菜单才有，如 /system/user" />
          </Form.Item>
          <Form.Item name="icon" label="图标名">
            <Input placeholder="如 UserOutlined" />
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
