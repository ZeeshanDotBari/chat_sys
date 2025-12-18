import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';
import { AuthenticatedRequest } from '@/lib/auth/middleware';

async function getPublicKey(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const userId = req.nextUrl.pathname.split('/').pop();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const user = await User.findById(userId).select('publicKey username');

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.publicKey) {
      return NextResponse.json(
        { error: 'User has not set up encryption keys' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      userId: user._id,
      username: user.username,
      publicKey: user.publicKey,
    });
  } catch (error: any) {
    console.error('Get public key error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get public key' },
      { status: 500 }
    );
  }
}

export const GET = authMiddleware(getPublicKey);

