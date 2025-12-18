'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { io, Socket } from 'socket.io-client';
import MessageTicks from './MessageTicks';
import DeleteMessageDialog from './DeleteMessageDialog';
import ForwardMessageDialog from './ForwardMessageDialog';
import CameraCapture from './CameraCapture';
import AddParticipantDialog from './AddParticipantDialog';
import EmojiPicker from './EmojiPicker';
import { useEncryption } from '@/lib/hooks/useEncryption';

interface ChatWindowProps {
  chat: any;
  currentUser: any;
  onChatUpdate: () => void;
}

export default function ChatWindow({ chat, currentUser, onChatUpdate }: ChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<any | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [addParticipantDialogOpen, setAddParticipantDialogOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatId = chat._id || chat.id;
  const socketRef = useRef<Socket | null>(null);
  
  // Encryption hook
  const encryption = useEncryption(currentUser?.id);
  const [recipientPublicKeys, setRecipientPublicKeys] = useState<{ [userId: string]: string }>({});
  const encryptionReadyRef = useRef(false);
  
  // Track encryption ready state
  useEffect(() => {
    if (!encryption.isInitializing && encryption.isEncryptionEnabled) {
      encryptionReadyRef.current = true;
      console.log('Encryption is ready');
    } else {
      encryptionReadyRef.current = false;
    }
  }, [encryption.isInitializing, encryption.isEncryptionEnabled]);

  useEffect(() => {
    loadMessages();
    initializeSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.off('message');
        socketRef.current.off('messageRead');
        socketRef.current.off('messageDeleted');
        socketRef.current.off('connect');
        socketRef.current.off('error');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Wait for encryption to initialize before doing anything
  useEffect(() => {
    if (encryption.isInitializing) {
      console.log('Waiting for encryption to initialize...');
    } else if (encryption.isEncryptionEnabled) {
      console.log('Encryption is ready');
    } else {
      console.warn('Encryption is not enabled');
    }
  }, [encryption.isInitializing, encryption.isEncryptionEnabled]);

  // Track the current chat ID to detect actual chat changes
  const currentChatIdRef = useRef<string | null>(null);
  
  // Load recipient public keys (encryption is mandatory)
  // Only clear cache when chat actually changes (not on every render)
  useEffect(() => {
    const chatId = chat._id || chat.id;
    
    // Only clear cache if this is a different chat
    if (currentChatIdRef.current !== chatId) {
      console.log('Chat changed, clearing public key cache. Old chat:', currentChatIdRef.current, 'New chat:', chatId);
      setRecipientPublicKeys({});
      currentChatIdRef.current = chatId;
    }
    
    const loadPublicKeys = async () => {
      if (!chat.participants) {
        // Don't clear keys here - just return
        return;
      }

      // Wait for encryption to be initialized (max 30 seconds)
      // This is important because key generation can take time
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds
      while (encryption.isInitializing && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (encryption.isInitializing) {
        console.warn('Encryption still initializing after timeout, will retry loading public keys when ready');
        // Don't return - try to load keys anyway, they might be available
        // The sendMessage function will handle missing keys gracefully
      }

      // Only load keys if encryption is enabled
      if (!encryption.isEncryptionEnabled) {
        console.warn('Encryption not enabled yet, skipping public key pre-load');
        return;
      }

      // Only load keys that aren't already cached
      const keys: { [userId: string]: string } = {};
      for (const participant of chat.participants) {
        const userId = participant._id || participant.id;
        if (userId && userId !== currentUser?.id) {
          // Check if we already have this key cached
          setRecipientPublicKeys((prev) => {
            if (prev[userId]) {
              // Key already cached, skip fetching
              return prev;
            }
            return prev;
          });
          
          // Only fetch if not in cache
          const existingKey = recipientPublicKeys[userId];
          if (!existingKey) {
            try {
              console.log(`Fetching fresh public key for user ${userId}`);
              const publicKey = await encryption.getPublicKey(userId);
              if (publicKey) {
                keys[userId] = publicKey;
                console.log(`Loaded public key for user ${userId}, length: ${publicKey.length}`);
              } else {
                console.warn(`Public key not found for user ${userId}`);
              }
            } catch (error: any) {
              console.error(`Failed to get public key for user ${userId}:`, error);
              // Continue loading other keys even if one fails
            }
          } else {
            console.log(`Using cached public key for user ${userId}`);
            keys[userId] = existingKey;
          }
        }
      }
      
      // Only update if we loaded new keys
      if (Object.keys(keys).length > 0) {
        setRecipientPublicKeys((prev) => ({
          ...prev,
          ...keys,
        }));
        console.log(`Loaded ${Object.keys(keys).length} public key(s) for chat participants`);
      }
    };

    loadPublicKeys();
  }, [chat.participants, currentUser?.id, encryption.isEncryptionEnabled, encryption.getPublicKey, chat._id, chat.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const markMessagesAsRead = useCallback(async () => {
    if (!socket || !currentUser || messages.length === 0) {
      console.log('Cannot mark as read:', { hasSocket: !!socket, hasUser: !!currentUser, messageCount: messages.length });
      return;
    }

    // Ensure socket is connected
    if (!socket.connected) {
      console.log('Socket not connected, cannot mark as read');
      return;
    }

    // Find unread messages from other participants
    const unreadMessages = messages.filter((msg) => {
      // Skip temp messages
      if (msg.id?.startsWith('temp-') || msg._id?.startsWith('temp-')) {
        return false;
      }

      const isOwnMessage = (msg.sender?._id || msg.sender?.id || msg.sender) === currentUser?.id;
      if (isOwnMessage) return false; // Don't mark own messages as read

      const readBy = msg.readBy || [];
      const currentUserId = String(currentUser?.id);
      // Check if current user already read this message
      const alreadyRead = readBy.some((id: any) => {
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
        return readById === currentUserId;
      });
      return !alreadyRead;
    });

    console.log(`Found ${unreadMessages.length} unread messages to mark`);

    // Mark each unread message as read
    for (const message of unreadMessages) {
      const messageId = message.id || message._id;
      if (messageId && !messageId.toString().startsWith('temp-')) {
        try {
          console.log(`Marking message ${messageId} as read`);
          socket.emit('markAsRead', {
            messageId,
            chatId,
          });
        } catch (error) {
          console.error('Failed to mark message as read:', error);
        }
      }
    }
  }, [socket, currentUser, messages, chatId]);

  // Mark messages as read when chat window is viewed
  useEffect(() => {
    if (!socket || !currentUser || !chatId || messages.length === 0) {
      return;
    }

    // Small delay to ensure messages are loaded and socket is ready
    const timer = setTimeout(() => {
      console.log('Marking messages as read for chat:', chatId);
      markMessagesAsRead();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [chatId, socket?.connected, currentUser?.id, messages.length, markMessagesAsRead]); // Include markMessagesAsRead in deps

  const initializeSocket = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Clean up existing socket
    if (socketRef.current) {
      socketRef.current.off('message');
      socketRef.current.off('connect');
      socketRef.current.off('error');
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      auth: {
        token,
      },
      path: '/api/socket',
      forceNew: true, // Force new connection to prevent reuse
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket');
      newSocket.emit('joinChat', chatId);
    });

    newSocket.on('message', async (message) => {
      // Decrypt message if encrypted (encryption is mandatory)
      let decryptedContent = message.content;
      
      // Check if this is the sender's own message
      const isOwnMessage = (message.sender?.id || message.sender?._id || message.sender) === currentUser?.id;
      
      if (message.isEncrypted && message.encryptedData && message.encryptedKey && message.iv) {
        // If it's our own message, we can't decrypt it (it was encrypted for the recipient)
        // The plain text should already be in the optimistic update
        if (isOwnMessage) {
          // For own messages, try to find the original content from temp message
          // or use the placeholder
          decryptedContent = message.content || '[Your message]';
        } else {
          // Wait for encryption to be ready (max 10 seconds)
          let attempts = 0;
          while (!encryptionReadyRef.current && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
          
          if (!encryptionReadyRef.current) {
            console.error('Encryption not ready for decryption after waiting', {
              isInitializing: encryption.isInitializing,
              isEncryptionEnabled: encryption.isEncryptionEnabled
            });
            decryptedContent = '[Encrypted message - decryption failed: encryption not initialized]';
          } else {
            try {
              console.log('Decrypting message from:', message.sender?.username || message.sender?.id);
              console.log('Decryption params check:', {
                hasEncryptedData: !!message.encryptedData,
                hasEncryptedKey: !!message.encryptedKey,
                hasIv: !!message.iv,
                encryptedDataLength: message.encryptedData?.length,
                encryptedKeyLength: message.encryptedKey?.length,
                ivLength: message.iv?.length,
                senderId: message.sender?.id || message.sender?._id,
                currentUserId: currentUser?.id,
                isEncryptionEnabled: encryption.isEncryptionEnabled,
                isInitializing: encryption.isInitializing,
              });
              decryptedContent = await encryption.decrypt(
                message.encryptedData,
                message.encryptedKey,
                message.iv
              );
              console.log('Message decrypted successfully, length:', decryptedContent.length);
            } catch (error: any) {
              console.error('Failed to decrypt message:', error);
              console.error('Decryption error details:', {
                messageId: message.id || message._id,
                senderId: message.sender?.id || message.sender?._id,
                senderUsername: message.sender?.username,
                currentUserId: currentUser?.id,
                hasEncryptedData: !!message.encryptedData,
                hasEncryptedKey: !!message.encryptedKey,
                hasIv: !!message.iv,
                encryptedDataLength: message.encryptedData?.length,
                encryptedKeyLength: message.encryptedKey?.length,
                ivLength: message.iv?.length,
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                isEncryptionEnabled: encryption.isEncryptionEnabled,
                isInitializing: encryption.isInitializing,
              });
              
              // Provide more helpful error message
              if (error.message?.includes('not encrypted for you') || error.message?.includes('different recipient')) {
                decryptedContent = '[Encrypted message - key mismatch. The sender may need to re-encrypt with your current public key.]';
              } else {
                decryptedContent = '[Encrypted message - decryption failed]';
              }
            }
          }
        }
      }

      setMessages((prev) => {
        // Normalize message ID format
        const messageId = message.id || message._id;
        
        // Check if this is the sender's own message FIRST
        const isOwnMessage = (message.sender?.id || message.sender?._id || message.sender) === currentUser?.id;
        
        // For own encrypted messages, find the temp message with original content
        let finalContent = decryptedContent;
        if (isOwnMessage && message.isEncrypted) {
          // Find the temp message by matching timestamp (within 5 seconds)
          const tempMsg = prev.find((m: any) => 
            m._tempStatus === 'sent' && 
            m._isOwnMessage &&
            Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000
          );
          if (tempMsg && tempMsg._originalContent) {
            finalContent = tempMsg._originalContent;
            console.log('Using original content for own encrypted message:', finalContent);
          } else {
            // If we can't find the original, use placeholder
            finalContent = '[Your message]';
            console.warn('Could not find original content for own message, using placeholder');
          }
        }
        
        // Remove any temporary messages with same content (optimistic update replacement)
        const filteredPrev = prev.filter((msg) => {
          // Keep temp messages that don't match this one
          if (msg.id?.startsWith('temp-')) {
            // For own messages, match by timestamp instead of content (since content is encrypted)
            if (isOwnMessage && msg._isOwnMessage) {
              return Math.abs(new Date(msg.createdAt).getTime() - new Date(message.createdAt).getTime()) > 5000;
            }
            return msg.content !== finalContent || 
                   Math.abs(new Date(msg.createdAt).getTime() - new Date(message.createdAt).getTime()) > 5000;
          }
          return true;
        });
        
        // Check if message already exists to prevent duplicates
        const exists = filteredPrev.some((msg) => {
          const msgId = msg.id || msg._id;
          return msgId === messageId;
        });
        if (exists) {
          console.log('Duplicate message prevented:', messageId);
          return filteredPrev;
        }
        
        // Normalize the message object to have consistent structure
        const normalizedMessage = {
          ...message,
          id: message.id || message._id,
          _id: message._id || message.id,
          content: finalContent, // Use decrypted content or original for own messages
          readBy: message.readBy || [],
          // Preserve file metadata
          fileName: message.fileName,
          fileSize: message.fileSize,
          fileUrl: message.fileUrl,
          fileType: message.fileType,
          // Preserve encryption status
          isEncrypted: message.isEncrypted || false,
          // Preserve deletion status
          deletedForEveryone: message.deletedForEveryone || message.isDeletedForEveryone || false,
          isDeletedForEveryone: message.deletedForEveryone || message.isDeletedForEveryone || false,
          deletedFor: (message.deletedFor || []).map((id: any) => {
            return id?.toString() || id?._id?.toString() || String(id);
          }),
          isDeletedForMe: (message.deletedFor || []).some((id: any) => {
            const idStr = id?.toString() || id?._id?.toString() || String(id);
            return idStr === currentUser?.id;
          }) || message.isDeletedForMe || false,
          // Preserve replyTo
          replyTo: message.replyTo || undefined,
        };
        return [...filteredPrev, normalizedMessage];
      });
      onChatUpdate();
    });

    newSocket.on('messageRead', (data: { messageId: string; userId: string; readBy?: string[] }) => {
      console.log('[ChatWindow] Received messageRead event:', data);
      setMessages((prev) => {
        const updated = prev.map((msg) => {
          const msgId = msg.id || msg._id;
          if (msgId === data.messageId) {
            // Always use readBy from server if provided (it's the source of truth)
            const updatedReadBy = Array.isArray(data.readBy) ? data.readBy : (msg.readBy || []);
            console.log(`[ChatWindow] Updating message ${msgId} readBy from [${msg.readBy?.join(', ') || 'empty'}] to [${updatedReadBy.join(', ')}]`);
            return {
              ...msg,
              readBy: updatedReadBy,
            };
          }
          return msg;
        });
        console.log('[ChatWindow] Updated messages state, triggering re-render');
        return updated;
      });
      onChatUpdate();
    });

    newSocket.on('messageDeleted', (data: { messageId: string; chatId: string; deleteType?: 'everyone' | 'me' }) => {
      console.log('[ChatWindow] Received messageDeleted event:', data);
      const deleteType = data.deleteType || 'everyone';
      
      // Mark message as deleted instead of removing it
      setMessages((prev) => {
        return prev.map((msg) => {
          const msgId = msg.id || msg._id;
          if (msgId === data.messageId) {
            if (deleteType === 'everyone') {
              return {
                ...msg,
                deletedForEveryone: true,
                isDeletedForEveryone: true,
              };
            } else if (deleteType === 'me') {
              // Only mark as deleted for me if it's the current user
              const deletedFor = msg.deletedFor || [];
              const currentUserId = currentUser?.id;
              if (currentUserId && !deletedFor.includes(currentUserId)) {
                deletedFor.push(currentUserId);
              }
              return {
                ...msg,
                deletedFor: deletedFor,
                isDeletedForMe: true,
              };
            }
          }
          return msg;
        });
      });
      onChatUpdate();
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getMessages(chatId);
      
      // Decrypt messages if encrypted (encryption is mandatory)
      // Wait for encryption to be ready (max 10 seconds)
      let attempts = 0;
      while (!encryptionReadyRef.current && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (!encryptionReadyRef.current) {
        console.error('Encryption not ready when loading messages', {
          isInitializing: encryption.isInitializing,
          isEncryptionEnabled: encryption.isEncryptionEnabled
        });
      }
      
      const decryptedMessages = await Promise.all(
        data.messages.map(async (msg: any) => {
          // Check if this is the sender's own message FIRST (before checking encryption)
          // Handle different ID formats - sender can be populated object or just ID
          let senderId: string | null = null;
          if (msg.sender) {
            if (typeof msg.sender === 'string') {
              senderId = msg.sender;
            } else if (msg.sender._id) {
              senderId = String(msg.sender._id);
            } else if (msg.sender.id) {
              senderId = String(msg.sender.id);
            } else if (typeof msg.sender === 'object' && msg.sender.toString) {
              senderId = String(msg.sender);
            }
          }
          
          const currentUserId = currentUser?.id || currentUser?._id;
          const currentUserIdStr = currentUserId ? String(currentUserId) : null;
          const isOwnMessage = senderId && currentUserIdStr && senderId === currentUserIdStr;
          
          // Debug logging for first few messages
          if (data.messages.indexOf(msg) < 3) {
            console.log('Message processing debug:', {
              messageId: msg.id || msg._id,
              sender: msg.sender,
              senderId,
              currentUserId: currentUserIdStr,
              isOwnMessage,
              isEncrypted: msg.isEncrypted,
              hasSenderContent: !!msg.senderContent,
              senderContentPreview: msg.senderContent?.substring(0, 30),
            });
          }
          
          // If it's our own message and it's encrypted, use senderContent
          if (isOwnMessage) {
            if (msg.isEncrypted && msg.senderContent) {
              console.log('✅ Using senderContent for own encrypted message:', {
                messageId: msg.id || msg._id,
                senderId,
                currentUserId: currentUserIdStr,
                hasSenderContent: !!msg.senderContent,
                senderContentLength: msg.senderContent?.length,
                senderContentPreview: msg.senderContent?.substring(0, 50),
              });
              return { ...msg, content: msg.senderContent };
            } else if (msg.isEncrypted && !msg.senderContent) {
              console.warn('⚠️ Own encrypted message but no senderContent found:', {
                messageId: msg.id || msg._id,
                senderId,
                currentUserId: currentUserIdStr,
                hasEncryptedData: !!msg.encryptedData,
                hasSenderContent: !!msg.senderContent,
                content: msg.content,
                allMessageKeys: Object.keys(msg),
              });
              return { ...msg, content: '[Your message]' };
            } else {
              // Own message but not encrypted - return as is
              return msg;
            }
          }
          
          // For encrypted messages from others, decrypt them
          if (msg.isEncrypted && msg.encryptedData && msg.encryptedKey && msg.iv) {
            
            if (!encryptionReadyRef.current) {
              return { ...msg, content: '[Encrypted message - decryption failed: encryption not initialized]' };
            }
            try {
              console.log('Decrypting loaded message from:', msg.sender?.username || msg.sender?.id);
              console.log('Decryption params:', {
                hasEncryptedData: !!msg.encryptedData,
                hasEncryptedKey: !!msg.encryptedKey,
                hasIv: !!msg.iv,
                encryptedDataLength: msg.encryptedData?.length,
                encryptedKeyLength: msg.encryptedKey?.length,
                ivLength: msg.iv?.length,
              });
              const decryptedContent = await encryption.decrypt(
                msg.encryptedData,
                msg.encryptedKey,
                msg.iv
              );
              console.log('Loaded message decrypted successfully, length:', decryptedContent.length);
              return { ...msg, content: decryptedContent };
            } catch (error: any) {
              console.error('Failed to decrypt message:', error);
              console.error('Decryption error details:', {
                messageId: msg.id || msg._id,
                senderId: msg.sender?.id || msg.sender?._id,
                senderUsername: msg.sender?.username,
                hasEncryptedData: !!msg.encryptedData,
                hasEncryptedKey: !!msg.encryptedKey,
                hasIv: !!msg.iv,
                encryptedDataLength: msg.encryptedData?.length,
                encryptedKeyLength: msg.encryptedKey?.length,
                ivLength: msg.iv?.length,
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack
              });
              return { ...msg, content: '[Encrypted message - decryption failed]' };
            }
          }
          return msg;
        })
      );
      
      // Normalize message IDs for consistency
      const normalizedMessages = decryptedMessages.map((msg: any) => ({
        ...msg,
        id: msg.id || msg._id,
        _id: msg._id || msg.id,
        readBy: (msg.readBy || []).map((id: any) => {
          // Normalize readBy IDs to strings
          return id?.toString() || id?._id?.toString() || String(id);
        }),
        // Preserve file metadata
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        fileUrl: msg.fileUrl,
        fileType: msg.fileType,
        // Preserve encryption status
        isEncrypted: msg.isEncrypted || false,
        // Preserve deletion status
        deletedForEveryone: msg.deletedForEveryone || msg.isDeletedForEveryone || false,
        isDeletedForEveryone: msg.deletedForEveryone || msg.isDeletedForEveryone || false,
        deletedFor: (msg.deletedFor || []).map((id: any) => {
          return id?.toString() || id?._id?.toString() || String(id);
        }),
        isDeletedForMe: (msg.deletedFor || []).some((id: any) => {
          const idStr = id?.toString() || id?._id?.toString() || String(id);
          return idStr === currentUser?.id;
        }) || msg.isDeletedForMe || false,
        // Preserve replyTo
        replyTo: msg.replyTo || undefined,
      }));
      setMessages(normalizedMessages);
      // Mark messages as read after loading (with delay to ensure socket is ready)
      setTimeout(() => {
        console.log('Messages loaded, marking as read...');
        markMessagesAsRead();
      }, 1000);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const messageContent = newMessage.trim();
    const replyToId = replyingTo ? (replyingTo.id || replyingTo._id) : null;
    setNewMessage('');
    setReplyingTo(null); // Clear reply after sending

    // Optimistically add message with "sent" status
    // Store original content for own messages (since we can't decrypt our own encrypted messages)
    const tempMessageId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempMessageId,
      _id: tempMessageId,
      chat: chatId,
      sender: {
        id: currentUser?.id,
        _id: currentUser?.id,
        username: currentUser?.username,
        email: currentUser?.email,
        avatar: currentUser?.avatar,
      },
      content: messageContent, // Store plain text for own message
      type: 'text',
      readBy: [],
      replyTo: replyingTo ? {
        id: replyToId,
        _id: replyToId,
        content: replyingTo.content,
        type: replyingTo.type,
        sender: replyingTo.sender,
        fileName: replyingTo.fileName,
        fileUrl: replyingTo.fileUrl,
      } : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      _tempStatus: 'sent', // Temporary status for optimistic update
      _isOwnMessage: true, // Flag to identify own messages
      _originalContent: messageContent, // Store original content for own messages
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      // Wait for encryption to be ready (max 10 seconds)
      let attempts = 0;
      while (!encryptionReadyRef.current && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (!encryptionReadyRef.current) {
        throw new Error('Encryption is not ready. Please wait a moment and try again.');
      }

      // Encrypt message if encryption is enabled and we have recipient keys
      let messageData: any = {
        chatId,
        content: messageContent,
        type: 'text',
      };

      // Add replyTo if replying to a message
      if (replyToId) {
        messageData.replyTo = replyToId;
      }

      // Encryption is mandatory - always encrypt
      // Get recipient IDs from chat participants
      const recipientIds: string[] = [];
      if (chat.participants) {
        for (const participant of chat.participants) {
          const userId = participant._id || participant.id;
          if (userId && userId !== currentUser?.id) {
            recipientIds.push(userId);
          }
        }
      }

      if (recipientIds.length === 0) {
        console.error('No recipients found for encryption');
        throw new Error('Cannot send message: No recipients found');
      } else if (recipientIds.length === 1) {
        // Direct chat - encrypt for single recipient
        let recipientPublicKey = recipientPublicKeys[recipientIds[0]];
        
        // If key not in cache, fetch it
        if (!recipientPublicKey) {
          try {
            console.log('Public key not in cache, fetching for recipient:', recipientIds[0]);
            
            // Ensure encryption is ready before fetching
            if (!encryptionReadyRef.current) {
              console.log('Waiting for encryption to be ready before fetching public key...');
              let attempts = 0;
              while (!encryptionReadyRef.current && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
              }
            }
            
            if (!encryption.isEncryptionEnabled) {
              throw new Error('Your encryption is not ready yet. Please wait a moment and try again.');
            }
            
            console.log('Fetching fresh public key for recipient:', recipientIds[0]);
            const fetchedKey = await encryption.getPublicKey(recipientIds[0]);
            if (fetchedKey) {
              recipientPublicKey = fetchedKey;
              // Update cache atomically with race condition protection
              setRecipientPublicKeys((prev) => {
                // If key was already cached while we were fetching, use the cached one
                if (prev[recipientIds[0]] && prev[recipientIds[0]] !== fetchedKey) {
                  console.warn('Public key was cached with different value while fetching, using cached version');
                  return prev;
                }
                console.log('Caching public key for recipient:', recipientIds[0], 'length:', fetchedKey.length);
                return {
                  ...prev,
                  [recipientIds[0]]: fetchedKey,
                };
              });
              console.log('Public key fetched and cached successfully');
            } else {
              console.error('Public key is null for recipient:', recipientIds[0]);
              throw new Error('Recipient does not have encryption enabled. They need to log in first to generate encryption keys.');
            }
          } catch (error: any) {
            console.error('Failed to get recipient public key:', error);
            if (error.message) {
              throw error;
            }
            throw new Error('Cannot send message: Recipient encryption key not available. The recipient may not have encryption set up yet.');
          }
        } else {
          console.log('Using cached public key for recipient:', recipientIds[0], 'length:', recipientPublicKey.length);
        }

        if (!recipientPublicKey) {
          throw new Error('Cannot send message: Recipient does not have encryption enabled. They need to log in first to generate encryption keys.');
        }

        // Always encrypt
        try {
          console.log('Encrypting message for recipient:', recipientIds[0]);
          const encrypted = await encryption.encrypt(messageContent, recipientPublicKey);
          console.log('Message encrypted successfully');
          messageData = {
            ...messageData,
            isEncrypted: true,
            encryptedData: encrypted.encryptedData,
            encryptedKey: encrypted.encryptedKey,
            iv: encrypted.iv,
            content: '[Encrypted]', // Placeholder content for recipient
            senderContent: messageContent, // Store original content for sender to view
          };
        } catch (error: any) {
          console.error('Encryption failed:', error);
          throw new Error(`Failed to encrypt message: ${error.message || 'Unknown error'}`);
        }
      } else {
        // Group chat - try to encrypt for all recipients who have keys
        // Collect public keys for all recipients
        const recipientKeys: { [userId: string]: string } = {};
        const recipientsWithoutKeys: string[] = [];
        
        // Ensure encryption is ready before fetching
        if (!encryptionReadyRef.current) {
          console.log('Waiting for encryption to be ready before fetching public keys...');
          let attempts = 0;
          while (!encryptionReadyRef.current && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
        }
        
        if (!encryption.isEncryptionEnabled) {
          throw new Error('Your encryption is not ready yet. Please wait a moment and try again.');
        }
        
        // Try to get public keys for all recipients
        for (const recipientId of recipientIds) {
          let recipientPublicKey = recipientPublicKeys[recipientId];
          
          if (!recipientPublicKey) {
            try {
              console.log('Fetching public key for group chat recipient:', recipientId);
              const fetchedKey = await encryption.getPublicKey(recipientId);
              if (fetchedKey) {
                recipientPublicKey = fetchedKey;
                setRecipientPublicKeys((prev) => ({
                  ...prev,
                  [recipientId]: fetchedKey,
                }));
                recipientKeys[recipientId] = fetchedKey;
                console.log('Public key fetched successfully for recipient:', recipientId);
              } else {
                recipientsWithoutKeys.push(recipientId);
                console.warn('Recipient does not have encryption keys:', recipientId);
              }
            } catch (error: any) {
              recipientsWithoutKeys.push(recipientId);
              console.warn('Failed to get public key for recipient:', recipientId, error.message);
            }
          } else {
            recipientKeys[recipientId] = recipientPublicKey;
          }
        }
        
        // Check if we have at least one recipient with keys
        const recipientsWithKeys = Object.keys(recipientKeys);
        
        if (recipientsWithKeys.length === 0) {
          // No recipients have encryption keys - show error
          const errorMsg = `Cannot send encrypted message: None of the ${recipientIds.length} recipient(s) have encryption keys set up. Please ask them to log in to generate encryption keys.`;
          alert(errorMsg);
          throw new Error(errorMsg);
        }
        
        // Show warning if some recipients don't have keys
        if (recipientsWithoutKeys.length > 0) {
          const warningMsg = `Warning: ${recipientsWithoutKeys.length} member(s) in this group don't have encryption keys set up. The message will be encrypted for ${recipientsWithKeys.length} member(s) who have keys, but those without keys won't be able to decrypt it.`;
          console.warn(warningMsg);
          // Show a non-blocking warning (user can still proceed)
          // You could use a toast notification here instead of alert
          const proceed = window.confirm(warningMsg + '\n\nDo you want to send the message anyway?');
          if (!proceed) {
            throw new Error('Message sending cancelled by user');
          }
        }
        
        // Encrypt for the first recipient with keys (for now - proper multi-recipient encryption would encrypt separately for each)
        // TODO: Implement proper multi-recipient encryption where each recipient gets their own encrypted copy
        const firstRecipientWithKey = recipientsWithKeys[0];
        const recipientPublicKey = recipientKeys[firstRecipientWithKey];
        
        console.log(`Encrypting group message for ${recipientsWithKeys.length} recipient(s) with keys (using first recipient's key for now)`);
        const encrypted = await encryption.encrypt(messageContent, recipientPublicKey);
        messageData = {
          ...messageData,
          isEncrypted: true,
          encryptedData: encrypted.encryptedData,
          encryptedKey: encrypted.encryptedKey,
          iv: encrypted.iv,
          content: '[Encrypted]',
          senderContent: messageContent, // Store original content for sender to view
        };
      }

      console.log('Sending encrypted message:', {
        chatId,
        isEncrypted: messageData.isEncrypted,
        hasEncryptedData: !!messageData.encryptedData,
      });
      socket.emit('sendMessage', messageData);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      // Remove temp message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      // Show user-friendly error
      alert(error.message || 'Failed to send message. Please try again.');
    }
  };

  const uploadAndSendFile = useCallback(async (file: File) => {
    if (!socket || !currentUser) return;

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      alert(`File size (${fileSizeMB} MB) exceeds the 5MB limit. Please choose a smaller file.`);
      return;
    }

    setUploading(true);

    try {
      // Upload file
      const uploadResult = await apiClient.uploadFile(file, chatId);
      const fileData = uploadResult.file;

      console.log('File uploaded successfully:', fileData);

      // Create optimistic message
      const tempMessage = {
        id: `temp-${Date.now()}`,
        _id: `temp-${Date.now()}`,
        chat: chatId,
        sender: {
          id: currentUser?.id,
          _id: currentUser?.id,
          username: currentUser?.username,
          email: currentUser?.email,
          avatar: currentUser?.avatar,
        },
        content: fileData.type === 'image' ? '📷 Image' : `📎 ${fileData.fileName}`,
        type: fileData.type,
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileUrl: fileData.fileUrl,
        fileType: fileData.fileType,
        readBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        _tempStatus: 'sent',
      };

      setMessages((prev) => [...prev, tempMessage]);

      // Prepare socket message data
      const socketMessageData = {
        chatId,
        content: fileData.type === 'image' ? '📷 Image' : `📎 ${fileData.fileName}`,
        type: fileData.type,
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileUrl: fileData.fileUrl,
        fileType: fileData.fileType,
      };

      console.log('Sending message via socket:', socketMessageData);

      // Send message via socket
      socket.emit('sendMessage', socketMessageData);
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [socket, currentUser, chatId]);

  const handleCameraCapture = useCallback(async (file: File) => {
    await uploadAndSendFile(file);
  }, [uploadAndSendFile]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket || !currentUser) return;
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      alert(`File size (${fileSizeMB} MB) exceeds the 5MB limit. Please choose a smaller file.`);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    await uploadAndSendFile(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      // Fetch the file as a blob
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }
      const blob = await response.blob();
      
      // Create a blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to download file:', error);
      // Fallback: open in new tab
      window.open(fileUrl, '_blank');
    }
  };

  const openDeleteDialog = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  }, []);

  const openForwardDialog = useCallback((message: any) => {
    setMessageToForward(message);
    setForwardDialogOpen(true);
  }, []);

  const handleForwardMessage = useCallback(async (targetChatId: string) => {
    if (!socket || !messageToForward || !currentUser) return;

    try {
      // Get the target chat to get participants for encryption
      const targetChatData = await apiClient.getChat(targetChatId);
      const targetChat = targetChatData.chat;

      // Prepare the forwarded message content
      // Add "Forwarded: " prefix to indicate it's a forwarded message
      let forwardedContent = `Forwarded: ${messageToForward.content}`;
      
      // If it's a file/image message, include file info
      if (messageToForward.type === 'file' || messageToForward.type === 'image') {
        forwardedContent = messageToForward.type === 'image' 
          ? 'Forwarded: 📷 Image' 
          : `Forwarded: 📎 ${messageToForward.fileName || 'File'}`;
      }

      // Wait for encryption to be ready
      let attempts = 0;
      while (!encryptionReadyRef.current && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (!encryptionReadyRef.current) {
        throw new Error('Encryption is not ready. Please wait a moment and try again.');
      }

      // Prepare message data
      let messageData: any = {
        chatId: targetChatId,
        content: forwardedContent,
        type: messageToForward.type || 'text',
      };

      // Include file metadata if it's a file/image
      if (messageToForward.type === 'file' || messageToForward.type === 'image') {
        messageData.fileName = messageToForward.fileName;
        messageData.fileSize = messageToForward.fileSize;
        messageData.fileUrl = messageToForward.fileUrl;
        messageData.fileType = messageToForward.fileType;
      }

      // Encrypt message for target chat participants
      const recipientIds: string[] = [];
      if (targetChat.participants) {
        for (const participant of targetChat.participants) {
          const userId = participant._id || participant.id;
          if (userId && userId !== currentUser?.id) {
            recipientIds.push(userId);
          }
        }
      }

      if (recipientIds.length === 0) {
        console.error('No recipients found for encryption');
        throw new Error('Cannot forward message: No recipients found');
      } else if (recipientIds.length === 1) {
        // Direct chat - encrypt for single recipient
        let recipientPublicKey = recipientPublicKeys[recipientIds[0]];
        
        if (!recipientPublicKey) {
          try {
            console.log('Public key not in cache, fetching for recipient:', recipientIds[0]);
            
            if (!encryptionReadyRef.current) {
              let attempts = 0;
              while (!encryptionReadyRef.current && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
              }
            }
            
            if (!encryption.isEncryptionEnabled) {
              throw new Error('Your encryption is not ready yet. Please wait a moment and try again.');
            }
            
            console.log('Fetching fresh public key for recipient:', recipientIds[0]);
            const fetchedKey = await encryption.getPublicKey(recipientIds[0]);
            if (fetchedKey) {
              recipientPublicKey = fetchedKey;
              setRecipientPublicKeys((prev) => ({
                ...prev,
                [recipientIds[0]]: fetchedKey,
              }));
            } else {
              throw new Error('Recipient does not have encryption enabled.');
            }
          } catch (error: any) {
            console.error('Failed to get recipient public key:', error);
            throw new Error('Cannot forward message: Recipient encryption key not available.');
          }
        }

        if (!recipientPublicKey) {
          throw new Error('Cannot forward message: Recipient does not have encryption enabled.');
        }

        try {
          console.log('Encrypting forwarded message for recipient:', recipientIds[0]);
          const encrypted = await encryption.encrypt(forwardedContent, recipientPublicKey);
          messageData = {
            ...messageData,
            isEncrypted: true,
            encryptedData: encrypted.encryptedData,
            encryptedKey: encrypted.encryptedKey,
            iv: encrypted.iv,
            content: '[Encrypted]',
            senderContent: forwardedContent,
          };
        } catch (error: any) {
          console.error('Encryption failed:', error);
          throw new Error(`Failed to encrypt message: ${error.message || 'Unknown error'}`);
        }
      } else {
        // Group chat - encrypt for first recipient with keys
        const recipientKeys: { [userId: string]: string } = {};
        
        if (!encryptionReadyRef.current) {
          let attempts = 0;
          while (!encryptionReadyRef.current && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
        }
        
        if (!encryption.isEncryptionEnabled) {
          throw new Error('Your encryption is not ready yet. Please wait a moment and try again.');
        }
        
        for (const recipientId of recipientIds) {
          let recipientPublicKey = recipientPublicKeys[recipientId];
          
          if (!recipientPublicKey) {
            try {
              const fetchedKey = await encryption.getPublicKey(recipientId);
              if (fetchedKey) {
                recipientPublicKey = fetchedKey;
                setRecipientPublicKeys((prev) => ({
                  ...prev,
                  [recipientId]: fetchedKey,
                }));
                recipientKeys[recipientId] = fetchedKey;
              }
            } catch (error: any) {
              console.warn('Failed to get public key for recipient:', recipientId);
            }
          } else {
            recipientKeys[recipientId] = recipientPublicKey;
          }
        }
        
        const recipientsWithKeys = Object.keys(recipientKeys);
        
        if (recipientsWithKeys.length === 0) {
          throw new Error('Cannot forward message: None of the recipients have encryption keys set up.');
        }
        
        const firstRecipientWithKey = recipientsWithKeys[0];
        const recipientPublicKey = recipientKeys[firstRecipientWithKey];
        
        console.log(`Encrypting forwarded group message for ${recipientsWithKeys.length} recipient(s)`);
        const encrypted = await encryption.encrypt(forwardedContent, recipientPublicKey);
        messageData = {
          ...messageData,
          isEncrypted: true,
          encryptedData: encrypted.encryptedData,
          encryptedKey: encrypted.encryptedKey,
          iv: encrypted.iv,
          content: '[Encrypted]',
          senderContent: forwardedContent,
        };
      }

      console.log('Forwarding message to chat:', targetChatId);
      socket.emit('sendMessage', messageData);
      
      setForwardDialogOpen(false);
      setMessageToForward(null);
    } catch (error: any) {
      console.error('Failed to forward message:', error);
      alert(error.message || 'Failed to forward message. Please try again.');
    }
  }, [socket, messageToForward, currentUser, encryption, recipientPublicKeys]);

  const handleDeleteMessage = useCallback(async (deleteType: 'everyone' | 'me') => {
    if (!socket || !messageToDelete) return;

    try {
      // Optimistically mark message as deleted instead of removing it
      setMessages((prev) => {
        return prev.map((msg) => {
          const msgId = msg.id || msg._id;
          if (msgId === messageToDelete) {
            if (deleteType === 'everyone') {
              return {
                ...msg,
                deletedForEveryone: true,
                isDeletedForEveryone: true,
              };
            } else if (deleteType === 'me') {
              const deletedFor = msg.deletedFor || [];
              const currentUserId = currentUser?.id;
              if (currentUserId && !deletedFor.includes(currentUserId)) {
                deletedFor.push(currentUserId);
              }
              return {
                ...msg,
                deletedFor: deletedFor,
                isDeletedForMe: true,
              };
            }
          }
          return msg;
        });
      });

      // Emit delete event via socket
      socket.emit('deleteMessage', {
        messageId: messageToDelete,
        chatId,
        deleteType,
      });

      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
      // Reload messages on error
      try {
        const data = await apiClient.getMessages(chatId);
        const normalizedMessages = data.messages.map((msg: any) => ({
          ...msg,
          id: msg.id || msg._id,
          _id: msg._id || msg.id,
          readBy: (msg.readBy || []).map((id: any) => {
            return id?.toString() || id?._id?.toString() || String(id);
          }),
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          fileUrl: msg.fileUrl,
          fileType: msg.fileType,
          deletedForEveryone: msg.deletedForEveryone || msg.isDeletedForEveryone || false,
          isDeletedForEveryone: msg.deletedForEveryone || msg.isDeletedForEveryone || false,
          deletedFor: (msg.deletedFor || []).map((id: any) => {
            return id?.toString() || id?._id?.toString() || String(id);
          }),
          isDeletedForMe: (msg.deletedFor || []).some((id: any) => {
            const idStr = id?.toString() || id?._id?.toString() || String(id);
            return idStr === currentUser?.id;
          }),
          // Preserve replyTo
          replyTo: msg.replyTo || undefined,
        }));
        setMessages(normalizedMessages);
      } catch (reloadError) {
        console.error('Failed to reload messages:', reloadError);
      }
    }
  }, [socket, chatId, messageToDelete, currentUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getChatName = () => {
    if (chat.name) return chat.name;
    if (chat.type === 'direct' && chat.participants) {
      // Find the participant that is NOT the current user
      const otherParticipant = chat.participants.find((p: any) => {
        const participantId = p._id || p.id;
        const currentUserId = currentUser?.id;
        return participantId !== currentUserId;
      });
      return otherParticipant?.username || 'Unknown User';
    }
    return 'Group Chat';
  };

  const getChatParticipants = () => {
    if (chat.participants && Array.isArray(chat.participants)) {
      return chat.participants
        .map((p: any) => p.username || p.email)
        .filter(Boolean)
        .join(', ');
    }
    return 'No participants';
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[#e77a4c] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Chat Header */}
      <div className="flex-shrink-0 p-6 bg-[#2D2D2D] border-b border-[#ABABAB]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-full bg-[#e77a4c] flex items-center justify-center text-white font-bold text-lg">
              {getChatName().charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">
                {getChatName()}
              </h2>
              <p className="text-sm text-[#ABABAB] mt-0.5">
                {getChatParticipants()}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAddParticipantDialogOpen(true)}
            className="p-3 text-[#e77a4c] hover:text-[#d4693a] hover:bg-[#e77a4c]/10 rounded-xl transition-all duration-300 hover:scale-110"
            title="Add person to chat"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages - Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 bg-[#2D2D2D]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 rounded-3xl border border-[#ABABAB]/20">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#e77a4c]/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-[#e77a4c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-white font-semibold text-lg">
                No messages yet
              </p>
              <p className="text-sm text-[#ABABAB] mt-2">
                Start the conversation!
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = (message.sender?._id || message.sender?.id || message.sender) === currentUser?.id;
            // Use message ID as key (should be unique after deduplication)
            const messageId = message.id || message._id;
            if (!messageId) {
              console.warn('Message without ID:', message);
            }
            
            // Check if message is deleted
            const isDeletedForEveryone = message.deletedForEveryone || message.isDeletedForEveryone || false;
            const deletedFor = message.deletedFor || [];
            const currentUserId = currentUser?.id;
            const isDeletedForMe = message.isDeletedForMe || (currentUserId && deletedFor.some((id: any) => {
              const idStr = id?.toString() || id?._id?.toString() || String(id);
              return idStr === String(currentUserId);
            })) || false;
            const isDeleted = isDeletedForEveryone || isDeletedForMe;
            
            return (
              <div
                key={messageId || `temp-${message.createdAt}-${Math.random()}`}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group message-enter`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-5 py-3 rounded-2xl relative transition-all duration-300 hover:scale-[1.02] ${
                    isOwnMessage
                      ? 'bg-[#e77a4c] text-white'
                      : 'bg-[#ABABAB]/10 text-white border border-[#ABABAB]/20'
                  } ${isDeleted ? 'opacity-60' : ''}`}
                >
                  {/* Action buttons - show on hover, and only if not deleted */}
                  {!isDeleted && (
                    <div className="absolute -top-2 -right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                      {/* Reply button - show for all messages */}
                      <button
                        onClick={() => setReplyingTo(message)}
                        className={`p-2 rounded-full transition-all duration-300 hover:scale-110 ${
                          isOwnMessage
                            ? 'bg-white/20 hover:bg-white/30 text-white'
                            : 'bg-[#e77a4c] hover:bg-[#d4693a] text-white'
                        }`}
                        title="Reply to message"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                          />
                        </svg>
                      </button>
                      {/* Forward button - show for all messages */}
                      <button
                        onClick={() => openForwardDialog(message)}
                        className={`p-2 rounded-full transition-all duration-300 hover:scale-110 ${
                          isOwnMessage
                            ? 'bg-white/20 hover:bg-white/30 text-white'
                            : 'bg-[#e77a4c] hover:bg-[#d4693a] text-white'
                        }`}
                        title="Forward message"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                          />
                        </svg>
                      </button>
                      {/* Delete button - only show for own messages */}
                      {isOwnMessage && !isDeletedForEveryone && (
                        <button
                          onClick={() => openDeleteDialog(messageId)}
                          className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-300 hover:scale-110"
                          title="Delete message"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Reply context - show if message is a reply */}
                  {message.replyTo && (
                    <div className={`mb-2 pl-3 border-l-2 ${
                      isOwnMessage ? 'border-white/30' : 'border-[#e77a4c]/50'
                    }`}>
                      <p className={`text-xs mb-1 ${
                        isOwnMessage ? 'text-white/70' : 'text-[#ABABAB]'
                      }`}>
                        {message.replyTo.sender?.username || 'Unknown'}
                      </p>
                      <p className={`text-sm truncate ${
                        isOwnMessage ? 'text-white/80' : 'text-[#ABABAB]'
                      }`}>
                        {message.replyTo.type === 'image' ? '📷 Image' : 
                         message.replyTo.type === 'file' ? `📎 ${message.replyTo.fileName || 'File'}` :
                         message.replyTo.content}
                      </p>
                    </div>
                  )}
                  
                  {!isOwnMessage && (
                    <p className="text-xs font-semibold mb-2 opacity-90">
                      {message.sender?.username || 'Unknown'}
                    </p>
                  )}
                  
                  {/* Show deleted message indicator */}
                  {isDeleted ? (
                    <div className="italic text-sm opacity-75 flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>This message was deleted</span>
                    </div>
                  ) : (
                    <>
                      {/* File/Image Display */}
                      {message.type === 'image' && message.fileUrl ? (
                    <div className="mb-2 relative group">
                      <img
                        src={message.fileUrl}
                        alt={message.fileName || 'Image'}
                        className="max-w-full h-auto rounded-lg cursor-pointer"
                        onClick={() => window.open(message.fileUrl, '_blank')}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(message.fileUrl, message.fileName || 'image');
                        }}
                        className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-black/90 rounded-full transition-opacity z-10"
                        title="Download image"
                      >
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    </div>
                      ) : message.type === 'file' && message.fileUrl ? (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 p-2 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors">
                        <svg
                          className="w-6 h-6 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {message.fileName || 'File'}
                          </p>
                          {message.fileSize && (
                            <p className="text-xs opacity-75">
                              {formatFileSize(message.fileSize)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            downloadFile(message.fileUrl, message.fileName || 'file');
                          }}
                          className="p-2 bg-[#e77a4c] hover:bg-[#d4693a] text-white rounded transition-colors flex-shrink-0"
                          title="Download file"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : null}
                  
                      {/* Message Content */}
                      {message.content && (
                        <p className="leading-relaxed">{message.content}</p>
                      )}
                      
                      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-[#ABABAB]/20">
                        <p className={`text-xs ${isOwnMessage ? 'text-white/80' : 'text-[#ABABAB]'}`}>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {!isDeleted && (
                          <MessageTicks message={message} currentUser={currentUser} chat={chat} />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="flex-shrink-0 p-6 bg-[#2D2D2D] border-t border-[#ABABAB]/20">
        {/* Reply Preview */}
        {replyingTo && (
          <div className="mb-3 p-3 bg-[#ABABAB]/10 border-l-4 border-[#e77a4c] rounded-lg relative">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#e77a4c] mb-1 font-medium">
                  Replying to {replyingTo.sender?.username || 'Unknown'}
                </p>
                <p className="text-sm text-white truncate">
                  {replyingTo.type === 'image' ? '📷 Image' : 
                   replyingTo.type === 'file' ? `📎 ${replyingTo.fileName || 'File'}` :
                   replyingTo.content}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 text-[#ABABAB] hover:text-white transition-colors flex-shrink-0"
                title="Cancel reply"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-3 items-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="*/*"
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={uploading}
            className="p-3 rounded-xl bg-[#ABABAB]/10 text-[#e77a4c] hover:text-[#d4693a] hover:bg-[#e77a4c]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-110 border border-[#ABABAB]/20"
            title="Take photo"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-3 rounded-xl bg-[#ABABAB]/10 text-[#e77a4c] hover:text-[#d4693a] hover:bg-[#e77a4c]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-110 border border-[#ABABAB]/20"
            title="Attach file"
          >
            {uploading ? (
              <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-5 py-3 rounded-xl bg-[#ABABAB]/10 text-white placeholder-[#ABABAB] focus:outline-none focus:ring-2 focus:ring-[#e77a4c]/50 border border-[#ABABAB]/20 transition-all duration-300"
            />
            <button
              type="button"
              onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#ABABAB] hover:text-[#e77a4c] transition-all duration-300 hover:scale-110 rounded-lg hover:bg-[#e77a4c]/10"
              title="Add emoji"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <EmojiPicker
              isOpen={emojiPickerOpen}
              onClose={() => setEmojiPickerOpen(false)}
              onEmojiSelect={(emoji) => {
                setNewMessage((prev) => prev + emoji);
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-6 py-3 bg-[#e77a4c] hover:bg-[#d4693a] text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
          >
            <span className="flex items-center gap-2">
              Send
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </span>
          </button>
        </div>
      </form>

      {/* Delete Message Dialog */}
      <DeleteMessageDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setMessageToDelete(null);
        }}
        onDelete={handleDeleteMessage}
      />

      {/* Forward Message Dialog */}
      <ForwardMessageDialog
        isOpen={forwardDialogOpen}
        onClose={() => {
          setForwardDialogOpen(false);
          setMessageToForward(null);
        }}
        onForward={handleForwardMessage}
        currentChatId={chatId}
        currentUserId={currentUser?.id}
      />

      {/* Camera Capture */}
      <CameraCapture
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* Add Participant Dialog */}
      <AddParticipantDialog
        isOpen={addParticipantDialogOpen}
        onClose={() => setAddParticipantDialogOpen(false)}
        onAdd={(updatedChat) => {
          // Update the chat in parent component
          onChatUpdate();
          // Optionally reload messages or update chat state
        }}
        chatId={chatId}
        currentUserId={currentUser?.id}
        existingParticipants={chat.participants || []}
      />
    </div>
  );
}


