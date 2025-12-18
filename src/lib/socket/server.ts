import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware } from './middleware/socketAuth';
import { setupConnectionHandlers } from './handlers/connectionHandler';
import { setupMessageHandlers } from './handlers/messageHandler';
import { setupChatHandlers } from './handlers/chatHandler';

let io: SocketIOServer | null = null;

export function initializeSocket(server: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/api/socket',
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Setup handlers
  setupConnectionHandlers(io);
  setupMessageHandlers(io);
  setupChatHandlers(io);

  console.log('✅ Socket.io server initialized');

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
}


