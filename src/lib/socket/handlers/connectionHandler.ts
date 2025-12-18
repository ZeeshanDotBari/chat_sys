import { Server } from 'socket.io';
import { Socket } from 'socket.io';
import connectDB from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';
import { SocketData } from '@/lib/types/socket';

export function setupConnectionHandlers(io: Server) {
  io.on('connection', async (socket: Socket) => {
    const socketData = socket.data as SocketData;
    const userId = socketData.userId;

    console.log(`User ${userId} connected`);

    try {
      await connectDB();
      
      // Update user online status
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
      });

      // Notify other users
      socket.broadcast.emit('userOnline', userId);

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log(`User ${userId} disconnected`);
        
        try {
          await connectDB();
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          socket.broadcast.emit('userOffline', userId);
        } catch (error) {
          console.error('Error updating user offline status:', error);
        }
      });
    } catch (error) {
      console.error('Connection handler error:', error);
    }
  });
}


