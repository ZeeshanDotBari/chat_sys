import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import { Chat, Message } from '@/lib/db/models';
import { createChatSchema } from '@/lib/utils/validators';
import { AuthenticatedRequest } from '@/lib/auth/middleware';

async function getChats(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const chats = await Chat.find({
      participants: req.user!.userId,
    })
      .populate('participants', 'username email avatar isOnline')
      .populate('lastMessage')
      .populate('createdBy', 'username')
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    return NextResponse.json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}

async function createChat(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const validatedData = createChatSchema.parse(body);

    // Check if direct chat already exists
    if (validatedData.type === 'direct' || validatedData.participants.length === 1) {
      const existingChat = await Chat.findOne({
        type: 'direct',
        participants: {
          $all: [req.user!.userId, ...validatedData.participants],
          $size: 2,
        },
      });

      if (existingChat) {
        await existingChat.populate('participants', 'username email avatar isOnline');
        await existingChat.populate('createdBy', 'username');
        return NextResponse.json({ chat: existingChat }, { status: 200 });
      }
    }

    const chat = await Chat.create({
      participants: [req.user!.userId, ...validatedData.participants],
      type: validatedData.type || 'direct',
      name: validatedData.name,
      description: validatedData.description,
      createdBy: req.user!.userId,
    });

    await chat.populate('participants', 'username email avatar isOnline');
    await chat.populate('createdBy', 'username');

    return NextResponse.json({ chat }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Create chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create chat' },
      { status: 500 }
    );
  }
}

export const GET = authMiddleware(getChats);
export const POST = authMiddleware(createChat);


