import { Socket } from 'socket.io';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { SocketData } from '@/lib/types/socket';

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const payload = verifyAccessToken(token);
    
    socket.data = {
      userId: payload.userId,
      email: payload.email,
    } as SocketData;

    next();
  } catch (error: any) {
    next(new Error('Invalid or expired token'));
  }
}

