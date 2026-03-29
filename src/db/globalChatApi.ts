import { API_BASE, authHeaders } from './apiClient';

export interface GlobalChatMessage {
  id: number;
  userId: number;
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
  const response = await fetch(`${API_BASE}/api/global-chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error('Failed to send global chat message');
  }

  return response.json();
}
