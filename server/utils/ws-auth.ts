import { verifyToken } from './jwt';

export interface WebSocketAuthPayload {
  userId: string;
  username: string;
}

export function authenticateWebSocket(token: string): WebSocketAuthPayload {
  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    if (!decoded.userId || !decoded.username) {
      throw new Error('Invalid token payload');
    }

    return {
      userId: decoded.userId,
      username: decoded.username
    };
  } catch (error) {
    console.error('WebSocket authentication failed:', error);
    throw new Error('Authentication failed');
  }
}

export function getWebSocketUrl(token: string): string {
  const protocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
  const host = process.env.WS_HOST || 'localhost:3000';
  return `${protocol}://${host}/ws?token=${encodeURIComponent(token)}`;
}
