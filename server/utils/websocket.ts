import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { verifyToken } from './jwt';
import { findUserById } from './userStorage';
import type { WebSocketMessage, WebSocketMessageType, TaskEventData, NotificationEventData, ErrorEventData } from './ws-events';

type MessageHandler<T = any> = (userId: string, message: WebSocketMessage<T>, ws: WebSocket) => void | Promise<void>;
type OnceHandler<T = any> = (userId: string, message: WebSocketMessage<T>, ws: WebSocket) => void | Promise<void>;
type WildcardHandler = (userId: string, message: WebSocketMessage, ws: WebSocket) => void | Promise<void>;
type ConnectionHandler = (userId: string, ws: WebSocket) => void | Promise<void>;
type DisconnectionHandler = (userId: string, ws: WebSocket) => void | Promise<void>;

interface EventListeners {
  messageHandlers: Map<WebSocketMessageType, MessageHandler[]>;
  onceHandlers: Map<WebSocketMessageType, OnceHandler[]>;
  wildcardHandlers: WildcardHandler[];
  connectionHandlers: ConnectionHandler[];
  disconnectionHandlers: DisconnectionHandler[];
}

const connectionPool = new Map<string, WebSocket[]>();

const eventListeners: EventListeners = {
  messageHandlers: new Map(),
  onceHandlers: new Map(),
  wildcardHandlers: [],
  connectionHandlers: [],
  disconnectionHandlers: []
};

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

      eventListeners.connectionHandlers.forEach(handler => {
        try {
          handler(userId, ws);
        } catch (error) {
          console.error('Connection handler error:', error);
        }
      });

      ws.on('message', (message: string) => {
        handleMessage(userId, message, ws);
      });

      ws.on('close', () => {
        removeConnection(userId, ws);
        console.log(`User ${userId} disconnected`);
        eventListeners.disconnectionHandlers.forEach(handler => {
          try {
            handler(userId, ws);
          } catch (error) {
            console.error('Disconnection handler error:', error);
          }
        });
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

function handleMessage(userId: string, message: string, ws: WebSocket): void {
  try {
    const parsedMessage: WebSocketMessage = JSON.parse(message.toString());
    console.log(`Message from user ${userId}:`, parsedMessage);

    eventListeners.wildcardHandlers.forEach(handler => {
      try {
        handler(userId, parsedMessage, ws);
      } catch (error) {
        console.error('Wildcard handler error:', error);
      }
    });

    const messageType = parsedMessage.type as WebSocketMessageType;

    const handlers = eventListeners.messageHandlers.get(messageType);
    if (handlers && handlers.length > 0) {
      handlers.forEach(handler => {
        try {
          handler(userId, parsedMessage, ws);
        } catch (error) {
          console.error('Message handler error:', error);
        }
      });
    }

    const onceHandles = eventListeners.onceHandlers.get(messageType);
    if (onceHandles && onceHandles.length > 0) {
      const handlersCopy = [...onceHandles];
      eventListeners.onceHandlers.delete(messageType);
      
      handlersCopy.forEach(handler => {
        try {
          handler(userId, parsedMessage, ws);
        } catch (error) {
          console.error('Once handler error:', error);
        }
      });
    }

    if (parsedMessage.type === 'ping') {
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

export function onWebSocketMessage<T = any>(type: WebSocketMessageType, handler: MessageHandler<T>): () => void {
  if (!eventListeners.messageHandlers.has(type)) {
    eventListeners.messageHandlers.set(type, []);
  }
  eventListeners.messageHandlers.get(type)!.push(handler as MessageHandler);
  
  return () => {
    const handlers = eventListeners.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler as MessageHandler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  };
}

export function onceWebSocketMessage<T = any>(type: WebSocketMessageType, handler: OnceHandler<T>): () => void {
  if (!eventListeners.onceHandlers.has(type)) {
    eventListeners.onceHandlers.set(type, []);
  }
  eventListeners.onceHandlers.get(type)!.push(handler as OnceHandler);
  
  return () => {
    const handlers = eventListeners.onceHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler as OnceHandler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  };
}

export function offWebSocketMessage<T = any>(type: WebSocketMessageType, handler: MessageHandler<T>): void {
  const handlers = eventListeners.messageHandlers.get(type);
  if (handlers) {
    const index = handlers.indexOf(handler as MessageHandler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
}

export function onAnyWebSocketMessage(handler: WildcardHandler): () => void {
  eventListeners.wildcardHandlers.push(handler);
  
  return () => {
    const index = eventListeners.wildcardHandlers.indexOf(handler);
    if (index > -1) {
      eventListeners.wildcardHandlers.splice(index, 1);
    }
  };
}

export function onWebSocketConnection(handler: ConnectionHandler): () => void {
  eventListeners.connectionHandlers.push(handler);
  
  return () => {
    const index = eventListeners.connectionHandlers.indexOf(handler);
    if (index > -1) {
      eventListeners.connectionHandlers.splice(index, 1);
    }
  };
}

export function onWebSocketDisconnection(handler: DisconnectionHandler): () => void {
  eventListeners.disconnectionHandlers.push(handler);
  
  return () => {
    const index = eventListeners.disconnectionHandlers.indexOf(handler);
    if (index > -1) {
      eventListeners.disconnectionHandlers.splice(index, 1);
    }
  };
}

export function sendTaskEventToUser(userId: string, data: TaskEventData): void {
  const message = {
    type: `task_${data.action}` as WebSocketMessageType,
    data,
    timestamp: new Date().toISOString()
  };
  sendToUser(userId, message);
}

export function sendTaskEventBroadcast(data: TaskEventData, excludeUserId?: string): void {
  const message = {
    type: `task_${data.action}` as WebSocketMessageType,
    data,
    timestamp: new Date().toISOString()
  };
  broadcast(message, excludeUserId);
}

export function sendNotificationToUser(userId: string, data: NotificationEventData): void {
  const message = {
    type: 'notification' as WebSocketMessageType,
    data,
    timestamp: new Date().toISOString()
  };
  sendToUser(userId, message);
}

export function sendNotificationBroadcast(data: NotificationEventData, excludeUserId?: string): void {
  const message = {
    type: 'notification' as WebSocketMessageType,
    data,
    timestamp: new Date().toISOString()
  };
  broadcast(message, excludeUserId);
}

export function sendErrorToUser(userId: string, data: ErrorEventData): void {
  const message = {
    type: 'error' as WebSocketMessageType,
    data,
    timestamp: new Date().toISOString()
  };
  sendToUser(userId, message);
}
