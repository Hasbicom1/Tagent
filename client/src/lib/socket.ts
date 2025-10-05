import { io, Socket } from 'socket.io-client';

export type SocketEvents = {
  automationStatus: (payload: any) => void;
  automationUpdate: (payload: any) => void;
};

export class RealtimeClient {
  private socket: Socket | null = null;

  connect(path = '/ws/socket.io/', query?: Record<string, string>): void {
    if (this.socket && this.socket.connected) return;
    this.socket = io({
      path,
      transports: ['websocket'],
      withCredentials: false,
      query,
    });
  }

  on<EventName extends keyof SocketEvents>(event: EventName, handler: SocketEvents[EventName]) {
    this.socket?.on(event as string, handler as any);
  }

  off<EventName extends keyof SocketEvents>(event: EventName, handler: SocketEvents[EventName]) {
    this.socket?.off(event as string, handler as any);
  }

  emit(event: string, payload?: any) {
    this.socket?.emit(event, payload);
  }

  join(room: string) {
    this.emit('join', { room });
  }

  leave(room: string) {
    this.emit('leave', { room });
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }
}

export const realtime = new RealtimeClient();
