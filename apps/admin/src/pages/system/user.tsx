import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as systemApi from '../../api/system';
import type { AdminUserRow, CreateUserPayload, RoleRow, UpdateUserPayload } from '../../api/system';

const STATUS_OPTIONS = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

export default function UserList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<AdminUserRow | null>(null);
  const [assignRow, setAssignRow] = useState<AdminUserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  const load = useCallback(async () => {
    try {
      // 角色下拉需要全量角色（数量少，用大 pageSize 拉全）
      const [users, roleList] = await Promise.all([
        systemApi.listUsers({ page, pageSize, keyword: keyword || undefined }),
        systemApi.listRoles({ page: 1, pageSize: 100 }),
      ]);
      setData(users.data.data.list);
      setTotal(users.data.data.total);
      setRoles(roleList.data.data.list);
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

  const roleOptions = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles]);

  const handleCreate = async () => {
    let values: CreateUserPayload;
    try {
      values = await createForm.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      await systemApi.createUser(values);
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
    let values: UpdateUserPayload;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    const payload = { ...values };
    if (!payload.password) delete payload.password;
    setSubmitting(true);
    try {
      await systemApi.updateUser(editRow.id, payload);
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
    let values: { roleIds: number[] };
    try {
      values = await assignForm.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      await systemApi.assignUserRoles(assignRow.id, values.roleIds ?? []);
      message.success('分配成功');
      setAssignRow(null);
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: AdminUserRow) => {
    try {
      await systemApi.deleteUser(row.id);
      message.success('删除成功');
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const columns: ColumnsType<AdminUserRow> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '用户名', dataIndex: 'username' },
    { title: '昵称', dataIndex: 'nickname' },
    {
      title: '角色',
      dataIndex: 'roles',
      render: (roles: AdminUserRow['roles']) =>
        roles.map((r) => <Tag key={r.role.id}>{r.role.name}</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: number) =>
        s === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      width: 170,
      render: (t: string | null) => (t ? new Date(t).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 230,
      render: (_, row) => (
        <Space size="small">
          {hasPermission('user:update') && (
            <Button size="small" onClick={() => setEditRow(row)}>
              编辑
            </Button>
          )}
          {hasPermission('user:assign-role') && (
            <Button size="small" onClick={() => setAssignRow(row)}>
              分配角色
            </Button>
          )}
          {hasPermission('user:delete') && (
            <Popconfirm title="确认删除该用户？" onConfirm={() => handleDelete(row)}>
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
          {hasPermission('user:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增用户
            </Button>
          )}
        </Space>
        <Input.Search
          allowClear
          placeholder="搜索用户名/昵称"
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
        title="新增用户"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" initialValues={{ status: 1 }}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}
          >
            <Input.Password maxLength={20} />
          </Form.Item>
          <Form.Item
            name="nickname"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select mode="multiple" allowClear options={roleOptions} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑用户"
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
            editRow ? { nickname: editRow.nickname, status: editRow.status } : undefined
          }
        >
          <Form.Item
            name="nickname"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="password" label="重置密码">
            <Input.Password maxLength={20} placeholder="留空则不修改" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="分配角色"
        open={!!assignRow}
        onOk={handleAssign}
        onCancel={() => setAssignRow(null)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form
          form={assignForm}
          layout="vertical"
          initialValues={assignRow ? { roleIds: assignRow.roles.map((r) => r.role.id) } : undefined}
        >
          <Form.Item name="roleIds" label="角色">
            <Select mode="multiple" allowClear options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
