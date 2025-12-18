// Use relative URLs by default (empty string), or allow override via env var
// In production, this will use the same domain, in dev it can be overridden
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('accessToken') 
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(text || `HTTP error! status: ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  }

  // Auth endpoints
  async register(data: { username: string; email: string; password: string }) {
    return this.request<{
      user: any;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{
      user: any;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyToken() {
    return this.request<{ user: any }>('/api/auth/verify', {
      method: 'GET',
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request<{ accessToken: string }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  // User endpoints
  async getCurrentUser() {
    return this.request<{
      id: string;
      username: string;
      email: string;
      avatar?: string;
      isOnline: boolean;
      lastSeen: Date;
    }>('/api/users', {
      method: 'GET',
    });
  }

  async getUserById(userId: string) {
    return this.request<any>(`/api/users/${userId}`, {
      method: 'GET',
    });
  }

  async searchUsers(query: string) {
    return this.request<{ users: any[] }>(`/api/users/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  }

  // Chat endpoints
  async getChats() {
    return this.request<{ chats: any[] }>('/api/chats', {
      method: 'GET',
    });
  }

  async createChat(data: {
    participants: string[];
    type?: 'direct' | 'group';
    name?: string;
    description?: string;
  }) {
    return this.request<{ chat: any }>('/api/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getChat(chatId: string) {
    return this.request<{ chat: any }>(`/api/chats/${chatId}`, {
      method: 'GET',
    });
  }

  async deleteChat(chatId: string) {
    return this.request<{ message: string }>(`/api/chats/${chatId}`, {
      method: 'DELETE',
    });
  }

  async addParticipant(chatId: string, userId: string) {
    return this.request<{ chat: any }>(`/api/chats/${chatId}/participants`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getMessages(chatId: string, page: number = 1, limit: number = 50) {
    return this.request<{
      messages: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/api/chats/${chatId}/messages?page=${page}&limit=${limit}`, {
      method: 'GET',
    });
  }

  // File upload
  async uploadFile(file: File, chatId: string) {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('accessToken') 
      : null;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatId', chatId);

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}/api/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  }

  // Delete message
  async deleteMessage(messageId: string, deleteType: 'everyone' | 'me' = 'everyone') {
    return this.request<{ success: boolean; message: string; deleteType: string }>(`/api/messages/${messageId}?type=${deleteType}`, {
      method: 'DELETE',
    });
  }

  // Encryption key endpoints
  async savePublicKey(publicKey: string) {
    return this.request<{ message: string; userId: string }>('/api/keys/generate', {
      method: 'POST',
      body: JSON.stringify({ publicKey }),
    });
  }

  async getPublicKey(userId: string) {
    return this.request<{ userId: string; username: string; publicKey: string }>(`/api/keys/${userId}`, {
      method: 'GET',
    });
  }
}

export const apiClient = new ApiClient();


