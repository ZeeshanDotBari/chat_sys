import { Server } from 'socket.io';
import { Socket } from 'socket.io';
import connectDB from '@/lib/db/mongodb';
import { Chat } from '@/lib/db/models';
import { SocketData } from '@/lib/types/socket';

export function setupChatHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    const socketData = socket.data as SocketData;
    const userId = socketData.userId;

    // This handler can be extended for group chat management
    // For now, chat creation is handled via API routes
  });
}


