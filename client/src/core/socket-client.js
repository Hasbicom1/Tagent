import { io } from "socket.io-client";

// WebSocket client for automation communication
const getSocketUrl = () => {
  // Use current host for Socket.IO connection
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}`;
};

export const socket = io(getSocketUrl(), {
  path: '/ws/socket.io/',
  transports: ["websocket", "polling"],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Connection status tracking
let isConnected = false;

socket.on('connect', () => {
  console.log('🔌 Automation socket connected:', socket.id);
  isConnected = true;
});

socket.on('disconnect', () => {
  console.log('🔌 Automation socket disconnected');
  isConnected = false;
});

socket.on('connect_error', (error) => {
  console.error('❌ Automation socket connection error:', error);
  isConnected = false;
});

export { isConnected };
