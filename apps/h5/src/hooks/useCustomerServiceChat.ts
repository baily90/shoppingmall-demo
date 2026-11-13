import { useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { getAccessToken } from '../api/request';

// 客服服务地址（Vite 环境变量可覆盖）
const SERVICE_URL =
  (import.meta.env.VITE_CUSTOMER_SERVICE_URL as string) ?? 'http://localhost:3002';

// 本地持久化的会话 id：刷新后仍用同一会话，历史从服务端 hydration 拉回
const SESSION_KEY = 'mall_cs_session_id';

// 从 UI message 的 parts 里提取纯文本（忽略 tool/reasoning 等中间步骤）
export function messageText(parts: Array<{ type: string; text?: string }>): string {
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

/**
 * 智能客服对话：封装 useChat（AI SDK v7）+ 服务端历史 hydration。
 * 会话 id 稳定不变（组件重挂载/刷新都指向同一条服务端会话）。
 */
export function useCustomerServiceChat() {
  const [sessionId] = useState(() => getOrCreateSessionId());

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
        const token = getAccessToken();
        const res = await fetch(
          `${SERVICE_URL}/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
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

  return { messages, sendMessage, loading, error, stop };
}
