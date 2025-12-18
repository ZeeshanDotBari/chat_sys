'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

interface ForwardMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onForward: (chatId: string) => void;
  currentChatId: string;
  currentUserId?: string;
}

export default function ForwardMessageDialog({
  isOpen,
  onClose,
  onForward,
  currentChatId,
  currentUserId,
}: ForwardMessageDialogProps) {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadChats();
    }
  }, [isOpen]);

  const loadChats = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getChats();
      // Filter out the current chat and only show chats where user is a participant
      const filteredChats = data.chats.filter((chat: any) => {
        const chatId = chat._id || chat.id;
        // Don't show the current chat
        if (chatId === currentChatId) return false;
        
        // Only show chats where current user is a participant
        if (chat.participants && Array.isArray(chat.participants)) {
          return chat.participants.some((p: any) => {
            const participantId = p._id || p.id;
            return participantId === currentUserId;
          });
        }
        return false;
      });
      setChats(filteredChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChatName = (chat: any) => {
    if (chat.name) return chat.name;
    if (chat.type === 'direct' && chat.participants) {
      // Find the participant that is NOT the current user
      const otherParticipant = chat.participants.find((p: any) => {
        const participantId = p._id || p.id;
        return participantId !== currentUserId;
      });
      return otherParticipant?.username || 'Unknown User';
    }
    return 'Group Chat';
  };

  const filteredChats = chats.filter((chat) => {
    const name = getChatName(chat).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Forward Message
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Select a chat to forward this message to:
        </p>

        {/* Search input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search chats..."
          className="w-full px-4 py-2 mb-4 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#e77a4c]"
        />

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading ? (
            <div className="text-center text-zinc-500 dark:text-zinc-400 py-4">
              Loading chats...
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center text-zinc-500 dark:text-zinc-400 py-4">
              {searchQuery ? 'No chats found' : 'No other chats available'}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const chatId = chat._id || chat.id;
              const chatName = getChatName(chat);
              
              return (
                <button
                  key={chatId}
                  onClick={() => {
                    onForward(chatId);
                    onClose();
                  }}
                  className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-50 rounded-lg transition-colors text-left"
                >
                  <div className="font-medium">{chatName}</div>
                  {chat.type === 'group' && chat.participants && (
                    <div className="text-sm opacity-75">
                      {chat.participants.length} participant{chat.participants.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

