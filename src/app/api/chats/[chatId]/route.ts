import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import { Chat } from '@/lib/db/models';
import { AuthenticatedRequest } from '@/lib/auth/middleware';

async function getChat(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const chatId = req.nextUrl.pathname.split('/').pop();

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user!.userId,
    })
      .populate('participants', 'username email avatar isOnline')
      .populate('lastMessage')
      .populate('createdBy', 'username');

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Get chat error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    );
  }
}

async function deleteChat(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const chatId = req.nextUrl.pathname.split('/').pop();

    const chat = await Chat.findOneAndDelete({
      _id: chatId,
      createdBy: req.user!.userId,
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Delete chat error:', error);
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    );
  }
}

export const GET = authMiddleware(getChat);
export const DELETE = authMiddleware(deleteChat);


