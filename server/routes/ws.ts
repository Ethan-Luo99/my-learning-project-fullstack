import { defineEventHandler } from 'h3';
import { initializeWebSocket } from '../utils/websocket';
import { initializeOfflineMessageDelivery } from '../utils/task-events';

export default defineEventHandler((event) => {
  const nodeRes = event.node.res;
  const server = nodeRes.socket?.server;

  if (!server) {
    throw new Error('HTTP server not available');
  }

  if (!(server as any).__websocket_initialized) {
    initializeWebSocket(server);
    initializeOfflineMessageDelivery();
    (server as any).__websocket_initialized = true;
  }

  return { 
    success: true, 
    message: 'WebSocket endpoint available at /ws' 
  };
});
