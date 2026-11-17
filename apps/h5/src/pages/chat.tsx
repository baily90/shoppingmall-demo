import { useEffect, useRef, useState } from 'react';
import { NavBar, Popup, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import type { UIMessage } from 'ai';
import { useCustomerServiceChat } from '../hooks/useCustomerServiceChat';
import ChatProductCard from '../components/ChatProductCard';
import type { ChatProduct } from '../components/ChatProductCard';
import ChatOrderCard from '../components/ChatOrderCard';
import type { ChatOrder } from '../components/ChatOrderCard';
import OrderDraftCard from '../components/OrderDraftCard';
import type { OrderDraft } from '../components/OrderDraftCard';
import NavEntryCard from '../components/NavEntryCard';
import type { NavEntry } from '../components/NavEntryCard';
import ChatMarkdown from '../components/ChatMarkdown';
import {
  deleteChatSession,
  listChatSessions,
  type ChatSessionSummary,
} from '../api/customer-service';

// 从消息 part 里识别「工具输出」（Generative UI：工具结果渲染成卡片）
function getToolOutput(part: unknown): { toolName: string; output: unknown } | null {
  const p = part as { type?: string; state?: string; toolName?: string; output?: unknown };
  const isTool =
    p.type === 'dynamic-tool' || (typeof p.type === 'string' && p.type.startsWith('tool-'));
  if (!isTool || p.state !== 'output-available') return null;
  // 工具名优先取 toolName，兜底从 type 前缀（tool-getProducts → getProducts）解析
  const toolName =
    p.toolName ??
    (typeof p.type === 'string' && p.type.startsWith('tool-') ? p.type.slice('tool-'.length) : '');
  return { toolName, output: p.output };
}

// 工具名 → 用户友好状态文案（给用户看「正在做什么」，不暴露内部工具名）
const TOOL_LABEL: Record<string, string> = {
  getProducts: '正在查询商品…',
  getOrders: '正在查询订单…',
  getAddresses: '正在查询收货地址…',
  createOrderDraft: '正在生成订单草稿…',
  getFaq: '正在查询售后政策…',
  db_query: '正在查询数据…',
  navigateTo: '正在跳转…',
};

// 从消息里找「当前正在执行」的工具：只要最后一条 part 是工具 part，就视为执行中
function currentToolName(messages: UIMessage[]): string | null {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return null;
  const part = last.parts[last.parts.length - 1] as
    { type?: string; toolName?: string } | undefined;
  if (!part) return null;
  // 静态工具 part 类型是 tool-xxx（无 toolName 字段，工具名在 type 前缀里）；dynamic-tool 才有 toolName
  if (part.type === 'dynamic-tool') return part.toolName ?? null;
  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    return part.type.slice('tool-'.length);
  }
  return null;
}

// 相对时间展示
function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function Chat() {
  const navigate = useNavigate();
  const { messages, sessionId, sendMessage, loading, error, stop, resetSession, switchSession } =
    useCustomerServiceChat();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // 历史会话抽屉
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);

  // 新消息 / 流式更新时滚到底部
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading]);

  // 当前正在执行的工具（用于实时步骤状态提示）
  const currentTool = loading ? currentToolName(messages) : null;

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    void sendMessage({ text });
  }

  const openHistory = async () => {
    setHistoryOpen(true);
    try {
      setSessions(await listChatSessions());
    } catch {
      Toast.show({ content: '拉取会话列表失败', icon: 'fail' });
    }
  };

  const handleSwitch = (id: string) => {
    switchSession(id);
    setHistoryOpen(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteChatSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === sessionId) resetSession(); // 删的是当前会话，自动开新会话
      Toast.show({ content: '已删除', icon: 'success' });
    } catch {
      Toast.show({ content: '删除失败', icon: 'fail' });
    }
  };

  const handleNew = () => {
    resetSession();
    setHistoryOpen(false);
    Toast.show({ content: '已开启新会话', icon: 'success' });
  };

  return (
    <div className="chat-page">
      <NavBar
        onBack={() => navigate(-1)}
        right={
          <div className="chat-nav-actions">
            <button type="button" className="chat-nav-btn" onClick={() => void openHistory()}>
              历史
            </button>
            <button type="button" className="chat-nav-btn" onClick={handleNew}>
              新会话
            </button>
          </div>
        }
      >
        智能客服
      </NavBar>

      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            你好，我是智能客服。可以问我订单、商品或售后问题，比如「我想买台电脑」「我的订单到哪了」。
          </div>
        )}
        {messages.flatMap((m) =>
          m.parts.map((part, i) => {
            const key = `${m.id}-${i}`;

            // 文本气泡（用户消息纯文本，助手消息渲染 Markdown）
            if (part.type === 'text') {
              if (!part.text) return null;
              const isUser = m.role === 'user';
              return (
                <div key={key} className={`chat-msg ${isUser ? 'user' : 'assistant'}`}>
                  <div className="chat-bubble">
                    {isUser ? part.text : <ChatMarkdown text={part.text} />}
                  </div>
                </div>
              );
            }

            // 思考过程（reasoning part，deepseek-reasoner 的思维链，折叠展示）
            if (part.type === 'reasoning') {
              if (!part.text) return null;
              return (
                <div key={key} className="chat-msg assistant">
                  <details className="chat-reasoning">
                    <summary>💭 思考过程</summary>
                    <div className="chat-reasoning-text">{part.text}</div>
                  </details>
                </div>
              );
            }

            const tool = getToolOutput(part);

            // 商品卡片（getProducts 工具输出）
            if (tool?.toolName === 'getProducts') {
              const products =
                (tool.output as { products?: ChatProduct[] } | undefined)?.products ?? [];
              if (products.length === 0) return null;
              return (
                <div key={key} className="chat-msg assistant">
                  <div className="chat-cards">
                    {products.map((p) => (
                      <ChatProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </div>
              );
            }

            // 订单卡片（getOrders 工具输出）
            if (tool?.toolName === 'getOrders') {
              const orders = (tool.output as { orders?: ChatOrder[] } | undefined)?.orders ?? [];
              if (orders.length === 0) return null;
              return (
                <div key={key} className="chat-msg assistant">
                  <div className="chat-cards">
                    {orders.map((o) => (
                      <ChatOrderCard key={o.id} order={o} />
                    ))}
                  </div>
                </div>
              );
            }

            // 订单草稿确认卡片（createOrderDraft 工具输出，human-in-the-loop）
            if (tool?.toolName === 'createOrderDraft') {
              const draft = tool.output as OrderDraft | undefined;
              if (!draft) return null;
              return (
                <div key={key} className="chat-msg assistant">
                  <OrderDraftCard draft={draft} />
                </div>
              );
            }

            // 跳转入口卡片（navigateTo 工具输出）
            if (tool?.toolName === 'navigateTo') {
              const entry = tool.output as NavEntry | undefined;
              if (!entry) return null;
              return (
                <div key={key} className="chat-msg assistant">
                  <NavEntryCard entry={entry} />
                </div>
              );
            }

            return null;
          }),
        )}
        {loading && (
          <div className="chat-typing">
            {currentTool ? (TOOL_LABEL[currentTool] ?? '正在处理…') : '正在输入…'}
          </div>
        )}
        {error && (
          <div className="chat-error">
            [出错了] {error.message}{' '}
            <button className="chat-stop" onClick={() => void stop()}>
              停止
            </button>
          </div>
        )}
      </div>

      {/* 历史会话抽屉 */}
      <Popup
        visible={historyOpen}
        position="right"
        onMaskClick={() => setHistoryOpen(false)}
        bodyStyle={{ width: '80vw', height: '100vh' }}
      >
        <div className="session-drawer">
          <div className="session-drawer-head">历史会话</div>
          <div className="session-list">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item${s.id === sessionId ? ' active' : ''}`}
                onClick={() => handleSwitch(s.id)}
              >
                <div className="session-item-main">
                  <div className="session-item-title">{s.title}</div>
                  <div className="session-item-time">{formatTime(s.updatedAt)}</div>
                </div>
                <button
                  type="button"
                  className="session-item-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(s.id);
                  }}
                >
                  删除
                </button>
              </div>
            ))}
            {sessions.length === 0 && <div className="session-empty">暂无历史会话</div>}
          </div>
        </div>
      </Popup>

      <div className="chat-input-bar">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
          placeholder="输入问题…"
        />
        <button className="chat-send" onClick={() => void send()} disabled={loading}>
          发送
        </button>
      </div>
    </div>
  );
}
