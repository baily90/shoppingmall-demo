import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import Home from './pages/home';
import Detail from './pages/detail';
import Login from './pages/login';
import Cart from './pages/cart';
import Checkout from './pages/checkout';
import AddressList from './pages/address';
import AddressEdit from './pages/address-edit';
import Orders from './pages/orders';
import OrderDetailPage from './pages/order-detail';
import Mine from './pages/mine';
import Coupons from './pages/coupons';
import CouponMine from './pages/coupon-mine';
import RequireAuth from './components/RequireAuth';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/list', element: <Navigate to="/" replace /> },
  { path: '/product/:id', element: <Detail /> },
  { path: '/login', element: <Login /> },
  { path: '/coupons', element: <Coupons /> },
  {
    path: '/coupons/mine',
    element: (
      <RequireAuth>
        <CouponMine />
      </RequireAuth>
    ),
  },
  {
    path: '/cart',
    element: (
      <RequireAuth>
        <Cart />
      </RequireAuth>
    ),
  },
  {
    path: '/checkout',
    element: (
      <RequireAuth>
        <Checkout />
      </RequireAuth>
    ),
  },
  {
    path: '/address',
    element: (
      <RequireAuth>
        <AddressList />
      </RequireAuth>
    ),
  },
  {
    path: '/address/edit',
    element: (
      <RequireAuth>
        <AddressEdit />
      </RequireAuth>
    ),
  },
  {
    path: '/address/edit/:id',
    element: (
      <RequireAuth>
        <AddressEdit />
      </RequireAuth>
    ),
  },
  {
    path: '/orders',
    element: (
      <RequireAuth>
        <Orders />
      </RequireAuth>
    ),
  },
  {
    path: '/order/:id',
    element: (
      <RequireAuth>
        <OrderDetailPage />
      </RequireAuth>
    ),
  },
  {
    path: '/mine',
    element: (
      <RequireAuth>
        <Mine />
      </RequireAuth>
    ),
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
