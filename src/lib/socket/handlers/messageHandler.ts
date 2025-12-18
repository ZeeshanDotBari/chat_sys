import { Server } from 'socket.io';
import { Socket } from 'socket.io';
import connectDB from '@/lib/db/mongodb';
import { Chat, Message } from '@/lib/db/models';
import { SocketData } from '@/lib/types/socket';

export function setupMessageHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    const socketData = socket.data as SocketData;
    const userId = socketData.userId;

    // Join chat room
    socket.on('joinChat', async (chatId: string) => {
      try {
        await connectDB();
        
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId,
        });

        if (chat) {
          socket.join(chatId);
          console.log(`User ${userId} joined chat ${chatId}`);
        }
      } catch (error) {
        console.error('Error joining chat:', error);
      }
    });

    // Leave chat room
    socket.on('leaveChat', (chatId: string) => {
      socket.leave(chatId);
      console.log(`User ${userId} left chat ${chatId}`);
    });

    // Send message
    socket.on('sendMessage', async (data: { 
      chatId: string; 
      content: string; 
      type?: string;
      fileName?: string;
      fileSize?: number;
      fileUrl?: string;
      fileType?: string;
      isEncrypted?: boolean;
      encryptedData?: string;
      encryptedKey?: string;
      iv?: string;
      senderContent?: string; // Original plaintext for sender
      replyTo?: string; // Message ID being replied to
    }) => {
      try {
        await connectDB();

        const { 
          chatId, 
          content, 
          type = 'text', 
          fileName, 
          fileSize, 
          fileUrl, 
          fileType,
          isEncrypted = false,
          encryptedData,
          encryptedKey,
          iv,
          senderContent,
          replyTo,
        } = data;
        
        console.log('Received sendMessage event with data:', {
          chatId,
          content,
          type,
          fileName,
          fileSize,
          fileUrl,
          fileType,
        });

        // Verify user is participant
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId,
        });

        if (!chat) {
          socket.emit('error', { message: 'Chat not found or unauthorized' });
          return;
        }

        // Create message - build complete object with all fields
        const messageData: any = {
          chat: chatId,
          sender: userId,
          content,
          type,
          isEncrypted: isEncrypted || false,
        };

        // Add encryption fields if message is encrypted
        if (isEncrypted && encryptedData && encryptedKey && iv) {
          messageData.encryptedData = encryptedData;
          messageData.encryptedKey = encryptedKey;
          messageData.iv = iv;
          // Store original content for sender to view their own messages
          if (senderContent) {
            messageData.senderContent = senderContent;
          }
        }

        // Always add file metadata fields if type is file or image
        if (type === 'file' || type === 'image') {
          if (fileName) messageData.fileName = String(fileName);
          if (fileSize !== undefined && fileSize !== null) messageData.fileSize = Number(fileSize);
          if (fileUrl) messageData.fileUrl = String(fileUrl);
          if (fileType) messageData.fileType = String(fileType);
        }

        // Add reply reference if provided
        if (replyTo) {
          // Verify the replyTo message exists in the same chat
          const replyToMessage = await Message.findOne({
            _id: replyTo,
            chat: chatId,
          });
          if (replyToMessage) {
            messageData.replyTo = replyTo;
          }
        }

        console.log('=== MESSAGE CREATION DEBUG ===');
        console.log('Received data:', JSON.stringify({ chatId, content, type, fileName, fileSize, fileUrl, fileType }, null, 2));
        console.log('Message data to save:', JSON.stringify(messageData, null, 2));

        // Create message with explicit field assignment
        const message = new Message(messageData);
        
        // Log before save
        console.log('Message object before save:', {
          fileName: (message as any).fileName,
          fileSize: (message as any).fileSize,
          fileUrl: (message as any).fileUrl,
          fileType: (message as any).fileType,
        });
        
        await message.save();
        
        // Reload message to verify all fields were saved
        const savedMessage = await Message.findById(message._id).lean();
        
        console.log('Message after save (from DB):', JSON.stringify(savedMessage, null, 2));
        console.log('=== END DEBUG ===');

        await message.populate('sender', 'username email avatar');
        
        // Populate replyTo if it exists
        if (message.replyTo) {
          await message.populate({
            path: 'replyTo',
            select: 'content sender type fileName fileUrl',
            populate: {
              path: 'sender',
              select: 'username email avatar',
            },
          });
        }

        // Update chat last message
        chat.lastMessage = message._id;
        chat.lastMessageAt = new Date();
        await chat.save();

        // Emit to all participants in the chat
        const messageId = message._id.toString();
        const messageToEmit: any = {
          id: messageId,
          _id: messageId,
          chat: chatId,
          sender: {
            id: message.sender._id.toString(),
            _id: message.sender._id.toString(),
            username: (message.sender as any).username,
            email: (message.sender as any).email,
            avatar: (message.sender as any).avatar,
          },
          content: message.content,
          type: message.type,
          readBy: message.readBy.map((id: any) => id.toString()),
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          senderContent: (message as any).senderContent, // Include senderContent for sender to view
        };

        // Add replyTo data if exists
        if (message.replyTo) {
          const replyToMsg = (message as any).replyTo;
          messageToEmit.replyTo = {
            id: replyToMsg._id.toString(),
            _id: replyToMsg._id.toString(),
            content: replyToMsg.content,
            type: replyToMsg.type,
            sender: replyToMsg.sender ? {
              id: replyToMsg.sender._id.toString(),
              username: replyToMsg.sender.username,
            } : null,
            fileName: replyToMsg.fileName,
            fileUrl: replyToMsg.fileUrl,
          };
        }

        // Add file metadata from saved message
        if (savedMessage) {
          messageToEmit.fileName = (savedMessage as any).fileName;
          messageToEmit.fileSize = (savedMessage as any).fileSize;
          messageToEmit.fileUrl = (savedMessage as any).fileUrl;
          messageToEmit.fileType = (savedMessage as any).fileType;
          // Add encryption fields
          messageToEmit.isEncrypted = (savedMessage as any).isEncrypted || false;
          messageToEmit.encryptedData = (savedMessage as any).encryptedData;
          messageToEmit.encryptedKey = (savedMessage as any).encryptedKey;
          messageToEmit.iv = (savedMessage as any).iv;
          messageToEmit.senderContent = (savedMessage as any).senderContent; // Include senderContent for sender to view
        }

        console.log('Emitting message:', JSON.stringify(messageToEmit, null, 2));
        
        io.to(chatId).emit('message', messageToEmit);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Mark message as read
    socket.on('markAsRead', async (data: { messageId: string; chatId: string }) => {
      try {
        await connectDB();

        const { messageId, chatId } = data;

        const message = await Message.findOne({
          _id: messageId,
          chat: chatId,
        });

        if (!message) {
          console.log('Message not found for markAsRead:', messageId);
          return;
        }

        // Check if user already read this message
        const userIdStr = userId.toString();
        const alreadyRead = (message.readBy || []).some((id: any) => {
          const readById = id?.toString() || id?._id?.toString() || String(id);
          return readById === userIdStr;
        });

        if (!alreadyRead) {
          message.readBy.push(userId as any);
          await message.save();

          // Emit updated message with readBy array
          const updatedMessage = await Message.findById(messageId)
            .populate('sender', 'username email avatar');
          
          if (!updatedMessage) {
            console.error('Updated message not found:', messageId);
            return;
          }

          const readByArray = updatedMessage.readBy.map((id: any) => {
            return id?.toString() || id?._id?.toString() || String(id);
          });

          console.log(`Message ${messageId} marked as read by user ${userIdStr}. ReadBy:`, readByArray);
          
          // Emit to all participants in the chat room
          io.to(chatId).emit('messageRead', {
            messageId,
            userId: userIdStr,
            readBy: readByArray,
          });
        } else {
          console.log(`Message ${messageId} already read by user ${userIdStr}`);
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Typing indicator
    socket.on('typing', (data: { chatId: string; isTyping: boolean }) => {
      socket.to(data.chatId).emit('typing', {
        userId,
        chatId: data.chatId,
        isTyping: data.isTyping,
      });
    });

    // Delete message
    socket.on('deleteMessage', async (data: { messageId: string; chatId: string; deleteType: 'everyone' | 'me' }) => {
      try {
        await connectDB();

        const { messageId, chatId, deleteType = 'everyone' } = data;

        // Find the message
        const message = await Message.findById(messageId);

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Verify user is participant in the chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId,
        });

        if (!chat) {
          socket.emit('error', { message: 'Chat not found or unauthorized' });
          return;
        }

        const currentUserId = userId.toString();

        if (deleteType === 'everyone') {
          // Only sender can delete for everyone
          const senderId = message.sender.toString();
          if (senderId !== currentUserId) {
            socket.emit('error', { message: 'Unauthorized: Only the sender can delete their message for everyone' });
            return;
          }

          // Mark as deleted for everyone
          message.deletedForEveryone = true;
          await message.save();

          // Emit to all participants in the chat room
          io.to(chatId).emit('messageDeleted', {
            messageId,
            chatId,
            deleteType: 'everyone',
          });
        } else if (deleteType === 'me') {
          // Anyone can delete for themselves
          const deletedFor = message.deletedFor || [];
          const userIdObj = userId as any;
          
          // Check if already deleted for this user
          if (!deletedFor.some((id: any) => id.toString() === currentUserId)) {
            deletedFor.push(userIdObj);
            message.deletedFor = deletedFor;
            await message.save();
          }

          // Emit only to the user who deleted it
          socket.emit('messageDeleted', {
            messageId,
            chatId,
            deleteType: 'me',
          });
        } else {
          socket.emit('error', { message: 'Invalid delete type. Use "everyone" or "me"' });
          return;
        }
      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });
  });
}

