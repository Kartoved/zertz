const API_BASE = import.meta.env.VITE_API_URL || '';

export interface GlobalChatMessage {
  id: number;
  username: string;
  message: string;
  createdAt: number;
}

export async function getGlobalChatMessages(afterId?: number): Promise<GlobalChatMessage[]> {
  const url = afterId
    ? `${API_BASE}/api/global-chat?after=${afterId}`
    : `${API_BASE}/api/global-chat`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch global chat messages');
  }

  return response.json();
}

export async function sendGlobalChatMessage(message: string): Promise<GlobalChatMessage> {
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/global-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error('Failed to send global chat message');
  }

  return response.json();
}
