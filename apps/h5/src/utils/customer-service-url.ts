// 客服服务地址统一出口
// - 本地开发：直连 customer-service（CORS 已在服务端放开）
// - 生产构建：默认走同域 /cs 路径，由 nginx 反代到 customer-service:3002
//   （避免把 localhost 打进生产包；需要跨域部署时用 VITE_CUSTOMER_SERVICE_URL 覆盖）
export const CUSTOMER_SERVICE_URL =
  (import.meta.env.VITE_CUSTOMER_SERVICE_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3002' : '/cs');
