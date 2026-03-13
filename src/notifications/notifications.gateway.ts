import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          staffProfile: true,
          managerLocations: true,
        },
      });

      if (!user) {
        client.disconnect();
        return;
      }

      client.data.user = user;

      client.join(`user:${user.id}`);

      if (user.role === 'MANAGER' || user.role === 'ADMIN') {
        const locations = user.managerLocations || [];
        locations.forEach((ml: any) => {
          client.join(`location:${ml.locationId}`);
        });
      }

      if (user.role === 'ADMIN') {
        client.join('admin');
      }

      client.join('on-duty');

      console.log(`Client connected: ${user.email} (${user.role})`);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (user) {
      console.log(`Client disconnected: ${user.email}`);
    }
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToLocation(locationId: string, event: string, data: any) {
    this.server.to(`location:${locationId}`).emit(event, data);
  }

  emitToAll(event: string, data: any) {
    this.server.to('on-duty').emit(event, data);
  }

  emitToAdmins(event: string, data: any) {
    this.server.to('admin').emit(event, data);
  }
}
