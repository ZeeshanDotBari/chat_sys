import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import { Chat, Message } from '@/lib/db/models';
import { AuthenticatedRequest } from '@/lib/auth/middleware';

async function handler(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const chatId = req.nextUrl.pathname.split('/')[3];
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Verify user is participant
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user!.userId,
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    const userId = req.user!.userId;
    
    // Find all messages (including deleted ones) - we'll show them with "deleted" indicator
    const messages = await Message.find({ 
      chat: chatId
    })
      .populate('sender', 'username email avatar _id')
      .populate({
        path: 'replyTo',
        select: 'content sender type fileName fileUrl',
        populate: {
          path: 'sender',
          select: 'username email avatar',
        },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean(); // Use lean() to get plain objects

    // Mark messages as deleted for the current user if applicable
    const processedMessages = messages.map((msg: any) => {
      // msg is already a plain object from lean()
      const isDeletedForEveryone = msg.deletedForEveryone === true;
      const deletedFor = msg.deletedFor || [];
      const userIdStr = userId.toString();
      const isDeletedForMe = deletedFor.some((id: any) => {
        const idStr = id?.toString() || id?._id?.toString() || String(id);
        return idStr === userIdStr;
      });
      
      // Normalize sender ID for easier comparison on frontend
      let senderId = null;
      if (msg.sender) {
        if (typeof msg.sender === 'string') {
          senderId = msg.sender;
        } else if (msg.sender._id) {
          senderId = String(msg.sender._id);
        } else if (msg.sender.id) {
          senderId = String(msg.sender.id);
        }
      }
      
      const result: any = {
        ...msg,
        id: String(msg._id), // Ensure id field exists
        _id: String(msg._id),
        sender: {
          ...(typeof msg.sender === 'object' ? msg.sender : {}),
          id: senderId || (typeof msg.sender === 'string' ? msg.sender : String(msg.sender?._id || msg.sender)),
          _id: senderId || (typeof msg.sender === 'string' ? msg.sender : String(msg.sender?._id || msg.sender)),
        },
        isDeletedForEveryone,
        isDeletedForMe,
      };
      
      // Ensure senderContent is included if it exists (for sender's own encrypted messages)
      if (msg.senderContent) {
        result.senderContent = msg.senderContent;
      }
      
      // Include replyTo data if exists
      if (msg.replyTo) {
        const replyToMsg = msg.replyTo as any;
        result.replyTo = {
          id: replyToMsg._id?.toString() || replyToMsg.id,
          _id: replyToMsg._id?.toString() || replyToMsg.id,
          content: replyToMsg.content,
          type: replyToMsg.type,
          sender: replyToMsg.sender ? {
            id: replyToMsg.sender._id?.toString() || replyToMsg.sender.id,
            username: replyToMsg.sender.username,
          } : null,
          fileName: replyToMsg.fileName,
          fileUrl: replyToMsg.fileUrl,
        };
      }
      
      return result;
    });

    const total = await Message.countDocuments({ chat: chatId });

    return NextResponse.json({
      messages: processedMessages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export const GET = authMiddleware(handler);


