import { getAccessToken } from './request';

const SERVICE_URL =
  (import.meta.env.VITE_CUSTOMER_SERVICE_URL as string) ?? 'http://localhost:3002';

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export async function listChatSessions(): Promise<ChatSessionSummary[]> {
  const res = await fetch(`${SERVICE_URL}/chat/sessions`, { headers: authHeaders() });
  if (!res.ok) throw new Error('拉取会话列表失败');
  return res.json();
}

export async function deleteChatSession(id: string): Promise<void> {
  const res = await fetch(`${SERVICE_URL}/chat/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('删除会话失败');
}
