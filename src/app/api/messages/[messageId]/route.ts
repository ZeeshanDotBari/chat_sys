import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import { Message } from '@/lib/db/models';
import { AuthenticatedRequest } from '@/lib/auth/middleware';

async function handler(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const messageId = req.nextUrl.pathname.split('/')[3];
    const userId = req.user!.userId;
    const searchParams = req.nextUrl.searchParams;
    const deleteType = searchParams.get('type') || 'everyone'; // 'everyone' or 'me'

    // Find the message
    const message = await Message.findById(messageId);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const currentUserId = userId.toString();

    if (deleteType === 'everyone') {
      // Only sender can delete for everyone
      const senderId = message.sender.toString();
      if (senderId !== currentUserId) {
        return NextResponse.json(
          { error: 'Unauthorized: Only the sender can delete their message for everyone' },
          { status: 403 }
        );
      }

      // Mark as deleted for everyone
      message.deletedForEveryone = true;
      await message.save();
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
    } else {
      return NextResponse.json(
        { error: 'Invalid delete type. Use "everyone" or "me"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Message deleted ${deleteType === 'everyone' ? 'for everyone' : 'for you'}`,
      deleteType,
    });
  } catch (error) {
    console.error('Delete message error:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}

export const DELETE = authMiddleware(handler);

