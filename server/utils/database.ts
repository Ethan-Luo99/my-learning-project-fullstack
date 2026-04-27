import { 
  findUserByUsername as findUserByUsernameFromStorage,
  findUserById as findUserByIdFromStorage,
  createUserWithHash,
  createUser as createUserFromStorage,
  type User
} from './userStorage';

import {
  findTaskById as findTaskByIdFromStorage,
  readTasksByUserId,
  createTask as createTaskFromStorage,
  updateTask as updateTaskFromStorage,
  deleteTask as deleteTaskFromStorage,
  type Task
} from './taskStorage';

export type UserData = User;
export type TaskData = Task;

export function findUserByUsername(username: string): UserData | undefined {
  return findUserByUsernameFromStorage(username);
}

export function findUserById(id: string): UserData | undefined {
  return findUserByIdFromStorage(id);
}

export async function createUser(userData: UserData): Promise<UserData> {
  const existingUser = findUserByUsername(userData.username);
  if (existingUser) {
    return existingUser;
  }
  
  return createUserWithHash(userData.username, userData.passwordHash);
}

export function findTasksByUserId(userId: string): TaskData[] {
  return readTasksByUserId(userId);
}

export function findTaskById(taskId: string): TaskData | undefined {
  return findTaskByIdFromStorage(taskId);
}

export function createTask(taskData: TaskData): void {
  const existingTask = findTaskById(taskData.id);
  if (existingTask) {
    return;
  }
  
  createTaskFromStorage(taskData.userId, taskData.title, taskData.description);
}

export function updateTask(taskId: string, updates: Partial<TaskData>): TaskData | undefined {
  return updateTaskFromStorage(taskId, updates);
}

export function deleteTask(taskId: string): boolean {
  return deleteTaskFromStorage(taskId);
}
