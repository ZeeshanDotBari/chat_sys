export interface ChatResponse {
  id: string;
  participants: string[];
  type: 'direct' | 'group';
  name?: string;
  description?: string;
  createdBy: string;
  lastMessage?: MessageResponse;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageResponse {
  id: string;
  chat: string;
  sender: string;
  content: string;
  type: 'text' | 'image' | 'file';
  readBy: string[];
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  fileType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChatRequest {
  participants: string[];
  type?: 'direct' | 'group';
  name?: string;
  description?: string;
}


