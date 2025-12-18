import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';
import { AuthenticatedRequest } from '@/lib/auth/middleware';
import type { Document } from 'mongoose';

async function handler(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (!query) {
      return NextResponse.json({ users: [] });
    }

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
      _id: { $ne: req.user!.userId },
    })
      .select('-password')
      .limit(20);

    const formattedUsers = users.map((user) => {
      const userObj = (user as Document).toObject();
      return {
        id: userObj._id.toString(),
        username: userObj.username,
        email: userObj.email,
        avatar: userObj.avatar,
        isOnline: userObj.isOnline,
        lastSeen: userObj.lastSeen,
      };
    });

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('Search users error:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}

export const GET = authMiddleware(handler);

