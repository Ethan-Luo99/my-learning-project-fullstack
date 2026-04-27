import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { verifyToken } from './jwt';
import { findUserById } from './userStorage';

const connectionPool = new Map<string, WebSocket[]>();

let wss: WebSocketServer | null = null;

export function initializeWebSocket(server: any): WebSocketServer {
  wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    console.log('WebSocket client connected');
    
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      const decoded = verifyToken(token);
      if (!decoded) {
        ws.close(1008, 'Invalid token');
        return;
      }
      
      const userId = decoded.userId;

      const user = findUserById(userId);
      if (!user) {
        ws.close(1008, 'Invalid user');
        return;
      }

      addConnection(userId, ws);

      ws.send(JSON.stringify({
        type: 'connected',
        data: { userId, message: 'WebSocket connected' },
        timestamp: new Date().toISOString()
      }));

      console.log(`User ${userId} connected via WebSocket`);

      ws.on('message', (message: string) => {
        handleMessage(userId, message);
      });

      ws.on('close', () => {
        removeConnection(userId, ws);
        console.log(`User ${userId} disconnected`);
      });

      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
        removeConnection(userId, ws);
      });

      startHeartbeat(ws);

    } catch (error) {
      console.error('Token verification failed:', error);
      ws.close(1008, 'Invalid token');
    }
  });

  console.log('WebSocket server initialized on /ws');
  return wss;
}

function addConnection(userId: string, ws: WebSocket): void {
  if (!connectionPool.has(userId)) {
    connectionPool.set(userId, []);
  }
  connectionPool.get(userId)!.push(ws);
}

function removeConnection(userId: string, ws: WebSocket): void {
  const connections = connectionPool.get(userId);
  if (connections) {
    const index = connections.indexOf(ws);
    if (index > -1) {
      connections.splice(index, 1);
    }
    if (connections.length === 0) {
      connectionPool.delete(userId);
    }
  }
}

function handleMessage(userId: string, message: string): void {
  try {
    const data = JSON.parse(message.toString());
    console.log(`Message from user ${userId}:`, data);

    if (data.type === 'ping') {
      const ws = getActiveConnections(userId)?.[0];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
      }
    }
  } catch (error) {
    console.error('Failed to parse message:', error);
  }
}

export function getActiveConnections(userId: string): WebSocket[] | undefined {
  const connections = connectionPool.get(userId);
  if (!connections) return undefined;

  return connections.filter(ws => ws.readyState === WebSocket.OPEN);
}

export function sendToUser(userId: string, message: any): void {
  const connections = getActiveConnections(userId);
  if (!connections || connections.length === 0) {
    console.log(`No active connections for user ${userId}`);
    return;
  }

  const messageStr = JSON.stringify(message);
  
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

export function broadcast(message: any, excludeUserId?: string): void {
  const messageStr = JSON.stringify(message);
  
  connectionPool.forEach((connections, userId) => {
    if (userId === excludeUserId) return;

    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  });
}

function startHeartbeat(ws: WebSocket): void {
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(interval);
    }
  }, 30000);

  ws.on('close', () => {
    clearInterval(interval);
  });
}

export function closeWebSocket(): void {
  if (wss) {
    wss.close(() => {
      console.log('WebSocket server closed');
    });
    wss = null;
  }
  
  connectionPool.forEach((connections) => {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutting down');
      }
    });
  });
  connectionPool.clear();
}

export function getConnectionStats(): { totalUsers: number; totalConnections: number } {
  let totalConnections = 0;
  connectionPool.forEach(connections => {
    totalConnections += connections.length;
  });

  return {
    totalUsers: connectionPool.size,
    totalConnections
  };
}
