'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import UserSearch from './UserSearch';

export default function ChatInterface() {
  const { user, logout } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const data = await apiClient.getChats();
      setChats(data.chats);
      if (data.chats.length > 0 && !selectedChat) {
        setSelectedChat(data.chats[0]);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSelect = (chat: any) => {
    setSelectedChat(chat);
    setShowUserSearch(false);
  };

  const handleNewChat = async (participantId: string) => {
    try {
      const data = await apiClient.createChat({
        participants: [participantId],
        type: 'direct',
      });
      await loadChats();
      setSelectedChat(data.chat);
      setShowUserSearch(false);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleChatCreated = () => {
    loadChats();
  };

  return (
    <div className="flex h-screen bg-[#2D2D2D] relative overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-[#2D2D2D] border-r border-[#ABABAB]/20 flex flex-col relative z-10">
        {/* Header */}
        <div className="p-6 border-b border-[#ABABAB]/20">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              &gt; Hash
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </h1>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm text-white hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all duration-300 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-[#e77a4c] flex items-center justify-center text-white font-bold text-lg transition-all duration-300 hover:scale-110">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#2D2D2D] animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white text-base">
                {user?.username}
              </p>
              <p className="text-xs text-[#ABABAB] mt-0.5">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUserSearch(!showUserSearch)}
            className="w-full px-4 py-3 bg-[#e77a4c] hover:bg-[#d4693a] text-white rounded-xl font-medium transition-all duration-300 hover:scale-[1.02]"
          >
            {showUserSearch ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close Search
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </span>
            )}
          </button>
        </div>

        {/* User Search or Chat List */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {showUserSearch ? (
            <div className="flex-1 overflow-y-auto">
              <UserSearch
                onUserSelect={handleNewChat}
                currentUserId={user?.id}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0">
              <ChatList
                chats={chats}
                selectedChat={selectedChat}
                onChatSelect={handleChatSelect}
                loading={loading}
                currentUserId={user?.id}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative z-10">
        {selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            currentUser={user}
            onChatUpdate={handleChatCreated}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-12 rounded-3xl border border-[#ABABAB]/20">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#e77a4c] flex items-center justify-center text-white animate-float">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-white text-xl font-semibold mb-2">
                Select a chat to start messaging
              </p>
              <p className="text-[#ABABAB] text-sm">
                Or create a new chat to get started
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

