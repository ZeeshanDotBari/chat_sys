export interface ServerToClientEvents {
  message: (message: any) => void;
  chatCreated: (chat: any) => void;
  userOnline: (userId: string) => void;
  userOffline: (userId: string) => void;
  messageRead: (data: { messageId: string; userId: string }) => void;
}

export interface ClientToServerEvents {
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  sendMessage: (data: { chatId: string; content: string; type?: string }) => void;
  markAsRead: (data: { messageId: string; chatId: string }) => void;
  typing: (data: { chatId: string; isTyping: boolean }) => void;
}

export interface InterServerEvents {
  // Empty for now
}

export interface SocketData {
  userId: string;
  email: string;
}


