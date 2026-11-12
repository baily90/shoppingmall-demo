import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { getAccessToken } from '../api/request';

// 客服服务地址（Vite 环境变量可覆盖）
const SERVICE_URL =
  (import.meta.env.VITE_CUSTOMER_SERVICE_URL as string) ?? 'http://localhost:3002';

// 本地持久化的会话 id：刷新后仍用同一会话，历史从服务端 hydration 拉回
const SESSION_KEY = 'mall_cs_session_id';

// 从 UI message 的 parts 里提取纯文本（忽略 tool/reasoning 等中间步骤）
function messageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
}

// 取 / 建会话 id（crypto.randomUUID 在 localhost / https 下均可用）
function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  // 会话 id 稳定不变（组件重挂载/刷新都指向同一条服务端会话）；lazy 初始化只读一次 localStorage
  const [sessionId] = useState(() => getOrCreateSessionId());

  // AI SDK v7 推荐：useChat + DefaultChatTransport（自动处理 SSE、消息状态、中断）
  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: `${SERVICE_URL}/chat`,
      headers: (): Record<string, string> => {
        const token = getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      // 服务端是有状态会话：只传 sessionId + 最新一条用户文本，历史全在服务端
      prepareSendMessagesRequest: ({ id, messages: msgs }) => {
        const last = msgs[msgs.length - 1];
        const text = last ? messageText(last.parts) : '';
        return { body: { sessionId: id, text } };
      },
    }),
  });

  const loading = status === 'submitted' || status === 'streaming';

  // 挂载时 hydration：拉取服务端历史回填（刷新后能看到之前的对话）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${SERVICE_URL}/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Array<{ id: string; role: string; parts: unknown }>;
        if (cancelled) return;
        // 过滤 tool 中间消息（UIMessage 无 tool role，且工具步骤不展示）
        setMessages(
          data
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({
              id: m.id,
              role: m.role as UIMessage['role'],
              parts: m.parts as UIMessage['parts'],
            })),
        );
      } catch {
        // 历史拉取失败不阻塞使用（新消息仍可发）
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages]);

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    void sendMessage({ text });
    // 等消息追加后再滚到底部（用 requestAnimationFrame 让 DOM 先更新）
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  }

  return (
    <>
      {/* 悬浮气泡按钮 */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 80,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          background: '#1677ff',
          color: '#fff',
          fontSize: 24,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 999,
        }}
        aria-label="客服"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* 聊天面板 */}
      {open && (
        <div
          style={{
            position: 'fixed',
            right: 16,
            bottom: 140,
            width: 320,
            maxHeight: 420,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 999,
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #eee', fontWeight: 600 }}>
            智能客服
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, minHeight: 200 }}>
            {messages.length === 0 && !loading && (
              <div style={{ color: '#999', fontSize: 13 }}>
                你好，我是智能客服。可以问我订单、商品或售后问题，比如「我的订单到哪了」。
              </div>
            )}
            {messages.map((m) => {
              const text = messageText(m.parts);
              if (!text) return null;
              return (
                <div
                  key={m.id}
                  style={{
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: m.role === 'user' ? '#1677ff' : '#f2f3f5',
                      color: m.role === 'user' ? '#fff' : '#333',
                      fontSize: 14,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {text}
                  </div>
                </div>
              );
            })}
            {loading && <div style={{ color: '#999', fontSize: 12 }}>正在输入…</div>}
            {error && (
              <div style={{ color: '#e5484d', fontSize: 12 }}>
                [出错了] {error.message}{' '}
                <button onClick={() => void stop()} style={{ cursor: 'pointer' }}>
                  停止
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid #eee', padding: 8, gap: 6 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send();
              }}
              placeholder="输入问题…"
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 8,
                border: '1px solid #ddd',
                fontSize: 14,
              }}
            />
            <button
              onClick={() => void send()}
              disabled={loading}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#1677ff',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
}
