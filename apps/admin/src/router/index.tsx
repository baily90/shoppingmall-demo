import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../store/auth';
import BasicLayout from '../layouts/BasicLayout';
import Login from '../pages/login';
import Dashboard from '../pages/dashboard';
import UserList from '../pages/system/user';
import RoleList from '../pages/system/role';
import PermissionList from '../pages/system/permission';
import CategoryList from '../pages/product/category';
import BrandList from '../pages/product/brand';
import ProductList from '../pages/product/product';
import Forbidden from '../pages/403';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function WithPermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <BasicLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      {
        path: 'system/user',
        element: (
          <WithPermission permission="user:list">
            <UserList />
          </WithPermission>
        ),
      },
      {
        path: 'system/role',
        element: (
          <WithPermission permission="role:list">
            <RoleList />
          </WithPermission>
        ),
      },
      {
        path: 'system/permission',
        element: (
          <WithPermission permission="permission:list">
            <PermissionList />
          </WithPermission>
        ),
      },
      {
        path: 'product/category',
        element: (
          <WithPermission permission="category:list">
            <CategoryList />
          </WithPermission>
        ),
      },
      {
        path: 'product/brand',
        element: (
          <WithPermission permission="brand:list">
            <BrandList />
          </WithPermission>
        ),
      },
      {
        path: 'product/product',
        element: (
          <WithPermission permission="product:list">
            <ProductList />
          </WithPermission>
        ),
      },
    ],
  },
  { path: '/403', element: <Forbidden /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
