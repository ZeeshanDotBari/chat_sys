import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  NEXT_PUBLIC_SOCKET_URL: z.string().default('http://localhost:3000'),
});

type EnvType = z.infer<typeof envSchema>;

let cachedEnv: EnvType | null = null;

function getEnv(): EnvType {
  if (!cachedEnv) {
    try {
      cachedEnv = envSchema.parse({
        MONGODB_URI: process.env.MONGODB_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
        JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
        NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
      });
    } catch (error: any) {
      console.error('Environment variable validation failed:', error.errors || error.message);
      const missingVars: string[] = [];
      if (!process.env.MONGODB_URI) missingVars.push('MONGODB_URI');
      if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET');
      if (!process.env.JWT_REFRESH_SECRET) missingVars.push('JWT_REFRESH_SECRET');
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}. ` +
        `Please set them in your Vercel project settings.`
      );
    }
  }
  return cachedEnv;
}

// Create a typed env object with getters
class EnvProxy {
  get MONGODB_URI(): string {
    return getEnv().MONGODB_URI;
  }
  get JWT_SECRET(): string {
    return getEnv().JWT_SECRET;
  }
  get JWT_REFRESH_SECRET(): string {
    return getEnv().JWT_REFRESH_SECRET;
  }
  get JWT_EXPIRES_IN(): string {
    return getEnv().JWT_EXPIRES_IN;
  }
  get JWT_REFRESH_EXPIRES_IN(): string {
    return getEnv().JWT_REFRESH_EXPIRES_IN;
  }
  get NEXT_PUBLIC_SOCKET_URL(): string {
    return getEnv().NEXT_PUBLIC_SOCKET_URL;
  }
}

export const env = new EnvProxy() as EnvType;

