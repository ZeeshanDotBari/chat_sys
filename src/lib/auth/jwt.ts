import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  const secret: string = env.JWT_SECRET;
  const expiresIn: string = env.JWT_EXPIRES_IN;
  return jwt.sign(payload, secret, {
    expiresIn,
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  const secret: string = env.JWT_REFRESH_SECRET;
  const expiresIn: string = env.JWT_REFRESH_EXPIRES_IN;
  return jwt.sign(payload, secret, {
    expiresIn,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const secret: string = env.JWT_SECRET;
    return jwt.verify(token, secret) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    const secret: string = env.JWT_REFRESH_SECRET;
    return jwt.verify(token, secret) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}


