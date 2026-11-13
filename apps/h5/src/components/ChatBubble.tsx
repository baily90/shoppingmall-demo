import { useLocation, useNavigate } from 'react-router-dom';

// 悬浮客服入口：点击跳转独立聊天页 /chat（在聊天页内隐藏）
export default function ChatBubble() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/chat') return null;

  return (
    <button
      onClick={() => navigate('/chat')}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 84,
        width: 52,
        height: 52,
        borderRadius: '50%',
        border: 'none',
        background: 'var(--c-accent)',
        color: '#fff',
        fontSize: 24,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: 999,
      }}
      aria-label="客服"
    >
      💬
    </button>
  );
}
