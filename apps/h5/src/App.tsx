import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Home from './pages/home';
import List from './pages/list';
import Detail from './pages/detail';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/list', element: <List /> },
  { path: '/product/:id', element: <Detail /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
