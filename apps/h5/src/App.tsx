import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import Home from './pages/home';
import Seckill from './pages/seckill';
import Detail from './pages/detail';
import Login from './pages/login';
import Cart from './pages/cart';
import Checkout from './pages/checkout';
import AddressList from './pages/address';
import AddressEdit from './pages/address-edit';
import Orders from './pages/orders';
import OrderDetailPage from './pages/order-detail';
import RefundApply from './pages/refund-apply';
import ReviewApply from './pages/review-apply';
import ReviewMine from './pages/review-mine';
import Favorites from './pages/favorites';
import Mine from './pages/mine';
import Coupons from './pages/coupons';
import CouponMine from './pages/coupon-mine';
import RequireAuth from './components/RequireAuth';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/list', element: <Navigate to="/" replace /> },
  { path: '/product/:id', element: <Detail /> },
  {
    path: '/seckill',
    element: (
      <RequireAuth>
        <Seckill />
      </RequireAuth>
    ),
  },
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
    path: '/order/:id/refund',
    element: (
      <RequireAuth>
        <RefundApply />
      </RequireAuth>
    ),
  },
  {
    path: '/order/:id/review',
    element: (
      <RequireAuth>
        <ReviewApply />
      </RequireAuth>
    ),
  },
  {
    path: '/reviews/mine',
    element: (
      <RequireAuth>
        <ReviewMine />
      </RequireAuth>
    ),
  },
  {
    path: '/favorites',
    element: (
      <RequireAuth>
        <Favorites />
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
