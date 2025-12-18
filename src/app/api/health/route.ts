import { NextResponse } from 'next/server';
import { env } from '@/config/env';
import connectDB from '@/lib/db/mongodb';

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      hasMongoURI: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasJwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
      mongoURILength: process.env.MONGODB_URI?.length || 0,
      jwtSecretLength: process.env.JWT_SECRET?.length || 0,
      jwtRefreshSecretLength: process.env.JWT_REFRESH_SECRET?.length || 0,
    };

    // Try to access env through the config
    let envAccessError = null;
    try {
      const mongoURI = env.MONGODB_URI;
      const jwtSecret = env.JWT_SECRET;
      const jwtRefreshSecret = env.JWT_REFRESH_SECRET;
    } catch (error: any) {
      envAccessError = error.message;
    }

    // Try to connect to MongoDB
    let dbConnection = false;
    let dbError = null;
    try {
      await connectDB();
      dbConnection = true;
    } catch (error: any) {
      dbError = error.message;
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        ...envCheck,
      },
      envAccessError,
      database: {
        connected: dbConnection,
        error: dbError,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

