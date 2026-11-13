import { useEffect, useRef, useState } from 'react';
import { NavBar } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { messageText, useCustomerServiceChat } from '../hooks/useCustomerServiceChat';

export default function Chat() {
  const navigate = useNavigate();
  const { messages, sendMessage, loading, error, stop } = useCustomerServiceChat();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // 新消息 / 流式更新时滚到底部
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading]);

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    void sendMessage({ text });
  }

  return (
    <div className="chat-page">
      <NavBar onBack={() => navigate(-1)}>智能客服</NavBar>

      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            你好，我是智能客服。可以问我订单、商品或售后问题，比如「我的订单到哪了」。
          </div>
        )}
        {messages.map((m) => {
          const text = messageText(m.parts);
          if (!text) return null;
          return (
            <div key={m.id} className={`chat-msg ${m.role === 'user' ? 'user' : 'assistant'}`}>
              <div className="chat-bubble">{text}</div>
            </div>
          );
        })}
        {loading && <div className="chat-typing">正在输入…</div>}
        {error && (
          <div className="chat-error">
            [出错了] {error.message}{' '}
            <button className="chat-stop" onClick={() => void stop()}>
              停止
            </button>
          </div>
        )}
      </div>

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
