import { sendTaskEventToUser, sendTaskEventBroadcast, getActiveConnections, onWebSocketConnection } from './websocket';
import type { Task, TaskWithUser } from './taskStorage';
import type { TaskEventData, WebSocketMessageType } from './ws-events';

type TaskAction = 'created' | 'updated' | 'deleted';

interface BatchTaskEvent {
  taskId: string;
  action: TaskAction;
  task?: Task | TaskWithUser;
}

interface OfflineMessage {
  id: string;
  userId: string;
  type: WebSocketMessageType;
  data: TaskEventData;
  timestamp: string;
}

const MAX_OFFLINE_MESSAGES_PER_USER = 100;
const MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const offlineMessageQueue = new Map<string, OfflineMessage[]>();

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function addOfflineMessage(
  userId: string,
  action: TaskAction,
  data: TaskEventData
): OfflineMessage {
  const message: OfflineMessage = {
    id: generateMessageId(),
    userId,
    type: `task_${action}` as WebSocketMessageType,
    data,
    timestamp: new Date().toISOString()
  };

  if (!offlineMessageQueue.has(userId)) {
    offlineMessageQueue.set(userId, []);
  }

  const userMessages = offlineMessageQueue.get(userId)!;
  
  if (userMessages.length >= MAX_OFFLINE_MESSAGES_PER_USER) {
    userMessages.shift();
  }

  userMessages.push(message);
  
  console.log(`[OfflineQueue] Added message ${message.id} for user ${userId}, total: ${userMessages.length}`);
  return message;
}

export function getOfflineMessages(userId: string): OfflineMessage[] {
  const messages = offlineMessageQueue.get(userId) || [];
  
  const now = Date.now();
  const validMessages = messages.filter(msg => {
    const msgTime = new Date(msg.timestamp).getTime();
    return (now - msgTime) < MESSAGE_TTL_MS;
  });

  offlineMessageQueue.set(userId, validMessages);
  return [...validMessages];
}

export function removeOfflineMessage(userId: string, messageId: string): boolean {
  const messages = offlineMessageQueue.get(userId);
  if (!messages) return false;

  const index = messages.findIndex(msg => msg.id === messageId);
  if (index > -1) {
    messages.splice(index, 1);
    console.log(`[OfflineQueue] Removed message ${messageId} for user ${userId}`);
    return true;
  }
  return false;
}

export function clearOfflineMessages(userId: string): void {
  offlineMessageQueue.delete(userId);
  console.log(`[OfflineQueue] Cleared all messages for user ${userId}`);
}

export function getOfflineMessageStats(): { 
  totalUsers: number; 
  totalMessages: number;
  usersWithMessages: { userId: string; messageCount: number }[];
} {
  let totalMessages = 0;
  const usersWithMessages: { userId: string; messageCount: number }[] = [];
  
  offlineMessageQueue.forEach((messages, userId) => {
    const validCount = messages.length;
    totalMessages += validCount;
    usersWithMessages.push({ userId, messageCount: validCount });
  });

  return {
    totalUsers: offlineMessageQueue.size,
    totalMessages,
    usersWithMessages
  };
}

export function smartPushToUser(
  userId: string,
  action: TaskAction,
  eventData: TaskEventData
): boolean {
  const activeConnections = getActiveConnections(userId);
  
  if (activeConnections && activeConnections.length > 0) {
    sendTaskEventToUser(userId, eventData);
    console.log(`[SmartPush] User ${userId} is online, sent directly`);
    return true;
  } else {
    addOfflineMessage(userId, action, eventData);
    console.log(`[SmartPush] User ${userId} is offline, queued for later delivery`);
    return false;
  }
}

export function deliverOfflineMessages(userId: string): OfflineMessage[] {
  const messages = getOfflineMessages(userId);
  
  if (messages.length === 0) {
    console.log(`[OfflineDelivery] No offline messages for user ${userId}`);
    return [];
  }

  const activeConnections = getActiveConnections(userId);
  if (!activeConnections || activeConnections.length === 0) {
    console.log(`[OfflineDelivery] User ${userId} not online, skipping delivery of ${messages.length} messages`);
    return [];
  }

  console.log(`[OfflineDelivery] Delivering ${messages.length} offline messages to user ${userId}`);
  
  const delivered: OfflineMessage[] = [];
  
  for (const message of messages) {
    const wsMessage = {
      type: message.type,
      data: message.data,
      timestamp: message.timestamp,
      isOffline: true,
      messageId: message.id
    };
    
    const wsMessageStr = JSON.stringify(wsMessage);
    let sendSuccess = false;
    
    try {
      activeConnections.forEach(ws => {
        if (ws.readyState === 1) {
          ws.send(wsMessageStr);
          sendSuccess = true;
        }
      });
    } catch (error) {
      console.error(`[OfflineDelivery] Failed to send message ${message.id} to user ${userId}:`, error);
      sendSuccess = false;
    }
    
    if (sendSuccess) {
      removeOfflineMessage(userId, message.id);
      delivered.push(message);
      console.log(`[OfflineDelivery] Delivered message ${message.id} to user ${userId}`);
    } else {
      console.log(`[OfflineDelivery] Failed to deliver message ${message.id} to user ${userId}, message retained`);
    }
  }

  return delivered;
}

export function initializeOfflineMessageDelivery(): void {
  onWebSocketConnection((userId) => {
    console.log(`[OfflineDelivery] User ${userId} connected, checking for offline messages`);
    deliverOfflineMessages(userId);
  });
  
  console.log('[OfflineQueue] Offline message delivery system initialized');
}

function createTaskEventData(
  taskId: string,
  action: TaskAction,
  task?: Task | TaskWithUser
): TaskEventData {
  const eventData: TaskEventData = {
    taskId,
    action
  };

  if (task) {
    eventData.task = {
      id: task.id,
      title: task.title,
      description: task.description,
      completed: task.completed,
      userId: task.userId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };

    if ('user' in task && task.user) {
      eventData.task.user = {
        id: task.user.id,
        username: task.user.username
      };
    }
  }

  return eventData;
}

export function pushTaskCreatedEvent(
  task: Task | TaskWithUser,
  excludeUserId?: string
): void {
  const eventData = createTaskEventData(task.id, 'created', task);
  
  if (excludeUserId) {
    sendTaskEventBroadcast(eventData, excludeUserId);
  } else {
    smartPushToUser(task.userId, 'created', eventData);
  }
}

export function pushTaskUpdatedEvent(
  task: Task | TaskWithUser,
  excludeUserId?: string
): void {
  const eventData = createTaskEventData(task.id, 'updated', task);
  
  if (excludeUserId) {
    sendTaskEventBroadcast(eventData, excludeUserId);
  } else {
    smartPushToUser(task.userId, 'updated', eventData);
  }
}

export function pushTaskDeletedEvent(
  task: Task | TaskWithUser,
  excludeUserId?: string
): void {
  const eventData = createTaskEventData(task.id, 'deleted', task);
  
  if (excludeUserId) {
    sendTaskEventBroadcast(eventData, excludeUserId);
  } else {
    smartPushToUser(task.userId, 'deleted', eventData);
  }
}

export function pushTaskEventBatch(
  events: BatchTaskEvent[],
  userId?: string,
  excludeUserId?: string
): void {
  for (const event of events) {
    const eventData = createTaskEventData(event.taskId, event.action, event.task);
    
    if (userId) {
      sendTaskEventToUser(userId, eventData);
    } else if (excludeUserId) {
      sendTaskEventBroadcast(eventData, excludeUserId);
    } else {
      console.warn('pushTaskEventBatch: No userId or excludeUserId specified, event not sent');
    }
  }
}

export function pushTaskEventToUser(
  userId: string,
  taskId: string,
  action: TaskAction,
  task?: Task | TaskWithUser
): void {
  const eventData = createTaskEventData(taskId, action, task);
  smartPushToUser(userId, action, eventData);
}

export function pushTaskEventBroadcast(
  taskId: string,
  action: TaskAction,
  task?: Task | TaskWithUser,
  excludeUserId?: string
): void {
  const eventData = createTaskEventData(taskId, action, task);
  sendTaskEventBroadcast(eventData, excludeUserId);
}

export { createTaskEventData };
export type { BatchTaskEvent, TaskAction, OfflineMessage };
