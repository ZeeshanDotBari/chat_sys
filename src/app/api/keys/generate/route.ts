import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';
import { AuthenticatedRequest } from '@/lib/auth/middleware';

async function generateKeys(req: AuthenticatedRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { publicKey } = body;

    if (!publicKey) {
      return NextResponse.json(
        { error: 'Public key is required' },
        { status: 400 }
      );
    }

    // Update user with public key
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { publicKey },
      { new: true }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Public key saved successfully',
      userId: user._id,
    });
  } catch (error: any) {
    console.error('Generate keys error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save public key' },
      { status: 500 }
    );
  }
}

export const POST = authMiddleware(generateKeys);

