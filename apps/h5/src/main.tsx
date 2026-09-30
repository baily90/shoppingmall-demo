import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { unstableSetRender } from 'antd-mobile';
import './index.css';
import App from './App.tsx';

// antd-mobile v5 的命令式组件（Toast/Dialog/Modal）默认走 React 16~18 的
// ReactDOM.render / unmountComponentAtNode，而 React 19 已移除这两个 API。
// 这里用 createRoot 适配，否则 Toast.show() 会报 unmountComponentAtNode is not a function。
const roots = new WeakMap<Element | DocumentFragment, Root>();
unstableSetRender((node, container) => {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  const resolvedRoot = root;
  resolvedRoot.render(node);
  return () =>
    new Promise<void>((resolve) => {
      // 等一帧让退出动画播完再卸载
      setTimeout(() => {
        resolvedRoot.unmount();
        roots.delete(container);
        resolve();
      }, 0);
    });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
