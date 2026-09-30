import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Home from './pages/home';
import List from './pages/list';
import Detail from './pages/detail';
import Login from './pages/login';
import Cart from './pages/cart';
import Checkout from './pages/checkout';
import AddressList from './pages/address';
import AddressEdit from './pages/address-edit';
import Orders from './pages/orders';
import OrderDetailPage from './pages/order-detail';
import Mine from './pages/mine';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/list', element: <List /> },
  { path: '/product/:id', element: <Detail /> },
  { path: '/login', element: <Login /> },
  { path: '/cart', element: <Cart /> },
  { path: '/checkout', element: <Checkout /> },
  { path: '/address', element: <AddressList /> },
  { path: '/address/edit', element: <AddressEdit /> },
  { path: '/address/edit/:id', element: <AddressEdit /> },
  { path: '/orders', element: <Orders /> },
  { path: '/order/:id', element: <OrderDetailPage /> },
  { path: '/mine', element: <Mine /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
