export type WebSocketMessageType =
  | 'connected'
  | 'pong'
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'notification'
  | 'error';

export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  data: T;
  timestamp: string;
  userId?: string;
}

export interface TaskEventTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    username: string;
  };
}

export interface TaskEventData {
  taskId: string;
  action: 'created' | 'updated' | 'deleted';
  task?: TaskEventTask;
}

export interface NotificationEventData {
  notificationId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
}

export interface ErrorEventData {
  code: string;
  message: string;
  details?: any;
}

export function createWebSocketMessage<T>(
  type: WebSocketMessageType,
  data: T,
  userId?: string
): WebSocketMessage<T> {
  return {
    type,
    data,
    timestamp: new Date().toISOString(),
    userId
  };
}
