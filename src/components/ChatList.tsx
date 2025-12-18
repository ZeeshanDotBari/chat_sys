'use client';

interface ChatListProps {
  chats: any[];
  selectedChat: any;
  onChatSelect: (chat: any) => void;
  loading: boolean;
  currentUserId?: string;
}

export default function ChatList({
  chats,
  selectedChat,
  onChatSelect,
  loading,
  currentUserId,
}: ChatListProps) {
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block w-8 h-8 border-4 border-[#e77a4c] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#ABABAB]">Loading chats...</p>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#e77a4c]/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#e77a4c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-white font-medium">No chats yet</p>
        <p className="text-sm text-[#ABABAB] mt-2">Start a new conversation!</p>
      </div>
    );
  }

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

  const getLastMessage = (chat: any) => {
    if (chat.lastMessage) {
      if (typeof chat.lastMessage === 'object') {
        return chat.lastMessage.content || 'No messages yet';
      }
      return 'No messages yet';
    }
    return 'No messages yet';
  };

  return (
    <div className="h-full p-2">
      {chats.map((chat, index) => {
        const isSelected = selectedChat?._id === chat._id || selectedChat?.id === chat._id;
        return (
          <div
            key={chat._id || chat.id}
            onClick={() => onChatSelect(chat)}
            className={`p-4 mb-2 rounded-xl cursor-pointer transition-all duration-300 message-enter ${
              isSelected 
                ? 'bg-[#e77a4c]/20 border-2 border-[#e77a4c]/30' 
                : 'border border-[#ABABAB]/20 hover:bg-[#ABABAB]/10'
            }`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 transition-all duration-300 ${
                isSelected 
                  ? 'bg-[#e77a4c] scale-110' 
                  : 'bg-[#e77a4c] hover:scale-110'
              }`}>
                {getChatName(chat).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className={`font-semibold truncate transition-colors ${
                    isSelected 
                      ? 'text-[#e77a4c]' 
                      : 'text-white'
                  }`}>
                    {getChatName(chat)}
                  </p>
                  {chat.lastMessageAt && (
                    <span className={`text-xs flex-shrink-0 ml-2 ${
                      isSelected 
                        ? 'text-[#e77a4c]' 
                        : 'text-[#ABABAB]'
                    }`}>
                      {new Date(chat.lastMessageAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <p className={`text-sm truncate transition-colors ${
                  isSelected 
                    ? 'text-white' 
                    : 'text-[#ABABAB]'
                }`}>
                  {getLastMessage(chat)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

