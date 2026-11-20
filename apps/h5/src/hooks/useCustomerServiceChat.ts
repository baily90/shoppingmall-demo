import { useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { getAccessToken } from '../api/request';
import { CUSTOMER_SERVICE_URL } from '../utils/customer-service-url';
import { randomUUID } from '../utils/random-uuid';

// 本地持久化的会话 id：刷新后仍用同一会话，历史从服务端 hydration 拉回
const SESSION_KEY = 'mall_cs_session_id';

// 从 UI message 的 parts 里提取纯文本（忽略 tool/reasoning 等中间步骤）
export function messageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
}

// 取 / 建会话 id（randomUUID 已兼容非安全上下文 http://公网IP）
function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * 智能客服对话：封装 useChat（AI SDK v7）+ 服务端历史 hydration。
 * 会话 id 可切换（新会话/历史会话），切换后重新拉取对应历史。
 */
export function useCustomerServiceChat() {
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId());

  const { messages, sendMessage, regenerate, clearError, status, error, stop, setMessages } =
    useChat({
      id: sessionId,
      transport: new DefaultChatTransport({
        api: `${CUSTOMER_SERVICE_URL}/chat`,
        headers: (): Record<string, string> => {
          const token = getAccessToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // 服务端是有状态会话：只传 sessionId + 最新一条用户文本，历史全在服务端。
        // regenerate 时取「最后一条用户消息」，并告诉服务端这是重试：
        // 服务端会复用已落库的用户消息、清掉上次失败留下的半截回答，避免重复问句。
        prepareSendMessagesRequest: ({ id, messages: msgs, trigger }) => {
          let lastUser: UIMessage | undefined;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'user') {
              lastUser = msgs[i];
              break;
            }
          }
          return {
            body: {
              sessionId: id,
              text: lastUser ? messageText(lastUser.parts) : '',
              retry: trigger === 'regenerate-message',
            },
          };
        },
      }),
    });

  const loading = status === 'submitted' || status === 'streaming';

  // sessionId 变化时 hydration：拉取该会话的服务端历史回填。
  // 用 updater 形式且只在本地还没有消息时回填，避免 hydration 请求慢于用户首次发送时覆盖新消息。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(
          `${CUSTOMER_SERVICE_URL}/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Array<{ id: string; role: string; parts: unknown }>;
        if (cancelled) return;
        // 过滤 tool 中间消息（UIMessage 无 tool role，且工具步骤不展示）
        const hydrated = data
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: m.id,
            role: m.role as UIMessage['role'],
            parts: m.parts as UIMessage['parts'],
          }));
        setMessages((prev) => (prev.length === 0 ? hydrated : prev));
      } catch {
        // 历史拉取失败不阻塞使用（新消息仍可发）
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages]);

  // 新会话：先停掉进行中的生成，再生成新 id + 清空消息
  const resetSession = () => {
    stop();
    clearError();
    const newId = randomUUID();
    localStorage.setItem(SESSION_KEY, newId);
    setMessages([]);
    setSessionId(newId);
  };

  // 切换到某个历史会话
  const switchSession = (id: string) => {
    stop();
    clearError();
    localStorage.setItem(SESSION_KEY, id);
    setMessages([]);
    setSessionId(id);
  };

  return {
    messages,
    sessionId,
    sendMessage,
    regenerate,
    clearError,
    loading,
    error,
    stop,
    resetSession,
    switchSession,
  };
}
