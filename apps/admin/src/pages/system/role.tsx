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
  Tree,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as systemApi from '../../api/system';
import type { CreateRolePayload, RoleRow, UpdateRolePayload } from '../../api/system';
import type { MenuNode } from '../../api/auth';

const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

function toTreeData(nodes: MenuNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: n.name,
    children: n.children.length ? toTreeData(n.children) : undefined,
  }));
}

export default function RoleList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<RoleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [perms, setPerms] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<RoleRow | null>(null);
  const [assignRow, setAssignRow] = useState<RoleRow | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const [roles, permissionTree] = await Promise.all([
        systemApi.listRoles({ page, pageSize, keyword: keyword || undefined }),
        systemApi.listPermissions(),
      ]);
      setData(roles.data.data.list);
      setTotal(roles.data.data.total);
      setPerms(permissionTree.data.data);
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

  const treeData = useMemo(() => toTreeData(perms), [perms]);

  const openAssign = (row: RoleRow) => {
    setAssignRow(row);
    setCheckedKeys(row.permissions.map((p) => p.permissionId));
  };

  const handleCreate = async () => {
    let values: CreateRolePayload;
    try {
      values = await createForm.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      await systemApi.createRole(values);
      message.success('新增成功');
      setCreateOpen(false);
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editRow) return;
    let values: UpdateRolePayload;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      await systemApi.updateRole(editRow.id, values);
      message.success('保存成功');
      setEditRow(null);
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!assignRow) return;
    setSubmitting(true);
    try {
      await systemApi.assignRolePermissions(assignRow.id, checkedKeys);
      message.success('分配成功');
      setAssignRow(null);
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: RoleRow) => {
    try {
      await systemApi.deleteRole(row.id);
      message.success('删除成功');
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const columns: ColumnsType<RoleRow> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '角色名', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code', render: (c: string) => <Tag>{c}</Tag> },
    { title: '描述', dataIndex: 'description', render: (d: string | null) => d ?? '-' },
    {
      title: '权限数',
      dataIndex: 'permissions',
      width: 90,
      render: (p: RoleRow['permissions']) => p.length,
    },
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
      width: 230,
      render: (_, row) => (
        <Space size="small">
          {hasPermission('role:update') && (
            <Button size="small" onClick={() => setEditRow(row)}>
              编辑
            </Button>
          )}
          {hasPermission('role:assign-permission') && (
            <Button size="small" onClick={() => openAssign(row)}>
              分配权限
            </Button>
          )}
          {hasPermission('role:delete') && (
            <Popconfirm title="确认删除该角色？" onConfirm={() => handleDelete(row)}>
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
          {hasPermission('role:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增角色
            </Button>
          )}
        </Space>
        <Input.Search
          allowClear
          placeholder="搜索角色名/编码"
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

      <Modal
        title="新增角色"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" initialValues={{ status: 1, sort: 0 }}>
          <Form.Item
            name="name"
            label="角色名"
            rules={[{ required: true, message: '请输入角色名' }]}
          >
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item
            name="code"
            label="编码"
            rules={[
              { required: true, message: '请输入编码' },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '小写字母开头，仅字母/数字/下划线' },
            ]}
          >
            <Input maxLength={30} placeholder="如 operator" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea maxLength={100} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑角色"
        open={!!editRow}
        onOk={handleEdit}
        onCancel={() => setEditRow(null)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          initialValues={
            editRow
              ? {
                  name: editRow.name,
                  code: editRow.code,
                  description: editRow.description,
                  status: editRow.status,
                  sort: editRow.sort,
                }
              : undefined
          }
        >
          <Form.Item
            name="name"
            label="角色名"
            rules={[{ required: true, message: '请输入角色名' }]}
          >
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item
            name="code"
            label="编码"
            rules={[
              { required: true, message: '请输入编码' },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '小写字母开头，仅字母/数字/下划线' },
            ]}
          >
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea maxLength={100} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`分配权限 - ${assignRow?.name ?? ''}`}
        open={!!assignRow}
        onOk={handleAssign}
        onCancel={() => setAssignRow(null)}
        confirmLoading={submitting}
        width={480}
      >
        <Tree
          checkable
          checkStrictly
          defaultExpandAll
          checkedKeys={checkedKeys}
          onCheck={(keys) => setCheckedKeys((keys as Key[]).map(Number))}
          treeData={treeData}
        />
      </Modal>
    </>
  );
}
