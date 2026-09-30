import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { App, Avatar, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import * as Icons from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import type { MenuNode } from '../api/auth';

const { Sider, Header, Content } = Layout;

function renderIcon(name?: string | null) {
  if (!name) return undefined;
  const Icon = (Icons as unknown as Record<string, ComponentType>)[name];
  return Icon ? <Icon /> : undefined;
}

function toMenuItems(menus: MenuNode[]): NonNullable<MenuProps['items']> {
  return menus.map((m) => {
    const icon = renderIcon(m.icon);
    if (m.type === 1) {
      return {
        key: m.path ?? m.code,
        icon,
        label: m.name,
        children: toMenuItems(m.children),
      };
    }
    return { key: m.path ?? m.code, icon, label: m.name };
  });
}

/** 返回 pathname 在菜单树中的所有祖先 key（不含自身），用于默认展开所属父级 */
function getAncestorKeys(
  menus: MenuNode[],
  pathname: string,
  parents: string[] = [],
): string[] | null {
  for (const m of menus) {
    const key = m.path ?? m.code;
    if (key === pathname) return parents;
    if (m.children?.length) {
      const found = getAncestorKeys(m.children, pathname, [...parents, key]);
      if (found !== null) return found;
    }
  }
  return null;
}

export default function BasicLayout() {
  const { user, logout } = useAuth();
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menus = useMemo(() => user?.menus ?? [], [user?.menus]);
  const menuItems = useMemo(() => toMenuItems(menus), [menus]);

  // 默认展开当前路由所属的父级
  const [openKeys, setOpenKeys] = useState<string[]>(
    () => getAncestorKeys(menus, location.pathname) ?? [],
  );

  useEffect(() => {
    setOpenKeys(getAncestorKeys(menus, location.pathname) ?? []);
  }, [location.pathname, menus]);

  // 手风琴：同一时间只展开一个父级
  const onOpenChange: MenuProps['onOpenChange'] = (keys) => {
    setOpenKeys(keys.length ? [keys[keys.length - 1]] : []);
  };

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    modal.confirm({
      title: '确认退出登录？',
      onOk: async () => {
        await logout();
        navigate('/login');
      },
    });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div
          style={{
            height: 48,
            margin: 16,
            color: '#fff',
            textAlign: 'center',
            lineHeight: '48px',
            fontWeight: 600,
            fontSize: collapsed ? 14 : 18,
          }}
        >
          {collapsed ? 'M' : '商城管理端'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={onOpenChange}
          items={menuItems}
          onClick={onMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} src={user?.avatar ?? undefined} />
              <Typography.Text>{user?.nickname ?? user?.username}</Typography.Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
