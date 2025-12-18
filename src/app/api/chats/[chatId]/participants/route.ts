import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import { Chat } from '@/lib/db/models';
import User from '@/lib/db/models/User';
import { AuthenticatedRequest } from '@/lib/auth/middleware';

async function addParticipant(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const chatId = req.nextUrl.pathname.split('/')[3];
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find the chat and verify user is a participant
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user!.userId,
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already a participant
    const isAlreadyParticipant = chat.participants.some(
      (p: any) => p.toString() === userId
    );

    if (isAlreadyParticipant) {
      return NextResponse.json(
        { error: 'User is already a participant in this chat' },
        { status: 400 }
      );
    }

    // Add user to participants
    chat.participants.push(userId);

    // Convert to group chat if it's a direct chat
    if (chat.type === 'direct') {
      chat.type = 'group';
      // Generate a default name if not set
      if (!chat.name) {
        const currentUser = await User.findById(req.user!.userId);
        chat.name = `${currentUser?.username}'s Group`;
      }
    }

    await chat.save();

    // Populate participants
    await chat.populate('participants', 'username email avatar isOnline');
    await chat.populate('createdBy', 'username');

    return NextResponse.json({ chat }, { status: 200 });
  } catch (error: any) {
    console.error('Add participant error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add participant' },
      { status: 500 }
    );
  }
}

export const POST = authMiddleware(addParticipant);

