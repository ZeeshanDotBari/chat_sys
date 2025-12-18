'use client';

interface MessageTicksProps {
  message: any;
  currentUser: any;
  chat: any;
}

export default function MessageTicks({ message, currentUser, chat }: MessageTicksProps) {
  const isOwnMessage = (message.sender?._id || message.sender?.id || message.sender) === currentUser?.id;
  
  // Only show ticks for own messages
  if (!isOwnMessage) {
    return null;
  }

  // Don't show ticks for deleted messages
  const isDeletedForEveryone = message.deletedForEveryone || message.isDeletedForEveryone || false;
  const deletedFor = message.deletedFor || [];
  const currentUserId = currentUser?.id;
  const isDeletedForMe = message.isDeletedForMe || (currentUserId && deletedFor.some((id: any) => {
    const idStr = id?.toString() || id?._id?.toString() || String(id);
    return idStr === String(currentUserId);
  })) || false;
  
  if (isDeletedForEveryone || isDeletedForMe) {
    return null;
  }

  // Get other participant in direct chat
  const getOtherParticipant = () => {
    if (chat.type === 'direct' && chat.participants) {
      return chat.participants.find((p: any) => {
        const participantId = p._id || p.id;
        return participantId !== currentUser?.id;
      });
    }
    return null;
  };

  const otherParticipant = getOtherParticipant();
  const readBy = message.readBy || [];
  const otherParticipantId = otherParticipant?._id || otherParticipant?.id;
  
  // Debug logging (only for own messages to reduce spam)
  if (isOwnMessage && readBy.length > 0) {
    console.log('[MessageTicks] Component render:', {
      messageId: message.id || message._id,
      currentUserId: currentUser?.id,
      otherParticipant: otherParticipant ? {
        id: otherParticipant._id || otherParticipant.id,
        username: otherParticipant.username,
      } : null,
      readBy: readBy,
      chatParticipants: chat.participants?.map((p: any) => ({
        id: p._id || p.id,
        username: p.username,
      })),
    });
  }
  
  // Check if other participant is online
  const isOtherParticipantOnline = otherParticipant?.isOnline || false;

  // Check if this is a temporary message (optimistic update)
  const isTempMessage = message.id?.startsWith('temp-') || message._id?.startsWith('temp-');
  const tempStatus = (message as any)._tempStatus;

  // Determine status
  let status: 'sent' | 'received' | 'read' = 'received'; // Default to received (delivered)
  
  // If it's a temporary message with sent status, show "Sent"
  if (isTempMessage && tempStatus === 'sent') {
    status = 'sent';
  } else if (chat.type === 'direct') {
    // For direct chat: check if other participant read it
    if (otherParticipantId) {
      const otherIdStr = String(otherParticipantId);
      
      // Check if other participant read it
      const isRead = readBy.some((id: any) => {
        // Handle different ID formats
        let readById = '';
        if (typeof id === 'string') {
          readById = id;
        } else if (id?._id) {
          readById = String(id._id);
        } else if (id?.id) {
          readById = String(id.id);
        } else {
          readById = String(id);
        }
        const matches = readById === otherIdStr;
        if (matches) {
          console.log(`[MessageTicks] Message read by ${otherIdStr}. readById: ${readById}, otherIdStr: ${otherIdStr}`);
        }
        return matches;
      });
      
      // Debug logging (only log once per render to avoid spam)
      if (readBy.length > 0 || isRead) {
        console.log(`[MessageTicks] Status check - messageId: ${message.id || message._id}, otherParticipantId: ${otherIdStr}, readBy:`, readBy, 'isRead:', isRead);
      }
      
      if (isRead) {
        status = 'read';
      } else {
        // Message is delivered but not read yet
        // If user is offline, show "Received" (they can't read it while offline)
        // If user is online, show "Received" (delivered but not viewed yet)
        status = 'received';
      }
    }
  } else {
    // For group chat: check if all participants (except sender) read it
    const otherParticipants = chat.participants?.filter((p: any) => {
      const participantId = p._id || p.id;
      return String(participantId) !== String(currentUser?.id);
    }) || [];
    
    if (otherParticipants.length > 0) {
      const allRead = otherParticipants.every((p: any) => {
        const participantId = String(p._id || p.id);
        return readBy.some((id: any) => {
          let readById = '';
          if (typeof id === 'string') {
            readById = id;
          } else if (id?._id) {
            readById = String(id._id);
          } else if (id?.id) {
            readById = String(id.id);
          } else {
            readById = String(id);
          }
          return readById === participantId;
        });
      });
      
      if (allRead) {
        status = 'read';
      }
    }
  }

  // Get status text and color
  const getStatusDisplay = () => {
    switch (status) {
      case 'sent':
        return { text: 'Sent', color: 'text-zinc-400 dark:text-zinc-500' };
      case 'received':
        return { text: 'Received', color: 'text-zinc-500 dark:text-zinc-400' };
      case 'read':
        return { text: 'Read', color: 'text-[#e77a4c]' };
      default:
        return { text: 'Received', color: 'text-zinc-500 dark:text-zinc-400' };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <span className={`ml-1 text-xs ${statusDisplay.color} font-medium`}>
      {statusDisplay.text}
    </span>
  );
}
