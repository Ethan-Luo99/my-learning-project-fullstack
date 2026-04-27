import { sendTaskEventToUser, sendTaskEventBroadcast } from './websocket';
import type { Task, TaskWithUser } from './taskStorage';
import type { TaskEventData } from './ws-events';

type TaskAction = 'created' | 'updated' | 'deleted';

interface BatchTaskEvent {
  taskId: string;
  action: TaskAction;
  task?: Task | TaskWithUser;
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
      userId: task.userId
    };
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
    sendTaskEventToUser(task.userId, eventData);
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
    sendTaskEventToUser(task.userId, eventData);
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
    sendTaskEventToUser(task.userId, eventData);
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
  sendTaskEventToUser(userId, eventData);
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
export type { BatchTaskEvent, TaskAction };
