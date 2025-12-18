import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  NEXT_PUBLIC_SOCKET_URL: z.string().default('http://localhost:3000'),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

function getEnv() {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse({
      MONGODB_URI: process.env.MONGODB_URI,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
      JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
    });
  }
  return cachedEnv;
}

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get: (_, prop) => getEnv()[prop as keyof typeof cachedEnv],
});

