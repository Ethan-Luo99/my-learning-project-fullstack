import { getDb } from './db';
import { findUserById, generateId, getCurrentTimestamp } from './userStorage';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskWithUser extends Task {
  user: {
    id: string;
    username: string;
  };
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id || ''),
    userId: String(row.userId || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    completed: Boolean(row.completed),
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || '')
  };
}

function rowToTaskWithUser(row: Record<string, unknown>): TaskWithUser {
  const userId = String(row.userId || '');
  const user = findUserById(userId);
  return {
    ...rowToTask(row),
    user: {
      id: user?.id || userId,
      username: user?.username || 'Unknown'
    }
  };
}

export function readTasksByUserId(userId: string): Task[] {
  const db = getDb();
  
  const rows = db.prepare(`
    SELECT id, userId, title, description, completed, createdAt, updatedAt
    FROM tasks
    WHERE userId = ?
    ORDER BY createdAt DESC
  `).all(userId) as Array<Record<string, unknown>>;
  
  return rows.map(rowToTask);
}

type StatusFilter = 'all' | 'active' | 'completed';
type SortField = 'createdAt' | 'updatedAt' | 'title' | 'priority';
type SortOrder = 'asc' | 'desc';

export interface TaskQueryOptions {
  status?: StatusFilter;
  sortBy?: SortField;
  order?: SortOrder;
}

export function readTasksWithUsersByUserId(
  userId: string,
  options?: TaskQueryOptions
): TaskWithUser[] {
  const db = getDb();
  
  let sql = `
    SELECT id, userId, title, description, completed, createdAt, updatedAt
    FROM tasks
    WHERE userId = ?
  `;
  
  const params: unknown[] = [userId];
  
  const status = options?.status || 'all';
  if (status === 'active') {
    sql += ' AND completed = 0';
  } else if (status === 'completed') {
    sql += ' AND completed = 1';
  }
  
  const sortBy = options?.sortBy || 'createdAt';
  const order = options?.order || 'desc';
  
  let orderBy = 'createdAt DESC';
  switch (sortBy) {
    case 'title':
      orderBy = `title ${order.toUpperCase()}`;
      break;
    case 'updatedAt':
      orderBy = `updatedAt ${order.toUpperCase()}`;
      break;
    case 'priority':
      orderBy = `createdAt ${order.toUpperCase()}`;
      break;
    case 'createdAt':
    default:
      orderBy = `createdAt ${order.toUpperCase()}`;
      break;
  }
  
  sql += ` ORDER BY ${orderBy}`;
  
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  
  return rows.map(rowToTaskWithUser);
}

export function findTaskById(taskId: string): Task | undefined {
  const db = getDb();
  
  const row = db.prepare(`
    SELECT id, userId, title, description, completed, createdAt, updatedAt
    FROM tasks
    WHERE id = ?
  `).get(taskId);
  
  return row ? rowToTask(row as Record<string, unknown>) : undefined;
}

export function findTaskWithUserById(taskId: string): TaskWithUser | undefined {
  const task = findTaskById(taskId);
  if (!task) return undefined;
  
  const user = findUserById(task.userId);
  return {
    ...task,
    user: {
      id: user?.id || task.userId,
      username: user?.username || 'Unknown'
    }
  };
}

export function createTask(userId: string, title: string, description: string = ''): Task {
  const db = getDb();
  const id = generateId();
  const now = getCurrentTimestamp();
  const completed = 0;
  
  db.prepare(`
    INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, description, completed, now, now);
  
  return {
    id,
    userId,
    title,
    description,
    completed: false,
    createdAt: now,
    updatedAt: now
  };
}

export function updateTask(taskId: string, updates: {
  completed?: boolean;
  title?: string;
  description?: string;
}): Task | undefined {
  const db = getDb();
  const existingTask = findTaskById(taskId);
  
  if (!existingTask) {
    return undefined;
  }
  
  const updateFields: string[] = [];
  const updateValues: unknown[] = [];
  
  const now = getCurrentTimestamp();
  updateFields.push('updatedAt = ?');
  updateValues.push(now);
  
  if (updates.completed !== undefined) {
    updateFields.push('completed = ?');
    updateValues.push(updates.completed ? 1 : 0);
  }
  
  if (updates.title !== undefined) {
    updateFields.push('title = ?');
    updateValues.push(updates.title);
  }
  
  if (updates.description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(updates.description);
  }
  
  if (updateFields.length === 0) {
    return existingTask;
  }
  
  updateValues.push(taskId);
  
  const sql = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...updateValues);
  
  return findTaskById(taskId);
}

export function deleteTask(taskId: string): boolean {
  const db = getDb();
  const existingTask = findTaskById(taskId);
  
  if (!existingTask) {
    return false;
  }
  
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  
  return result.changes > 0;
}

export function isTaskOwner(taskId: string, userId: string): boolean {
  const task = findTaskById(taskId);
  if (!task) return false;
  return task.userId === userId;
}

export function getTaskCountByUserId(userId: string): number {
  const db = getDb();
  
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE userId = ?
  `).get(userId) as { count: number };
  
  return result.count;
}

export interface TaskStats {
  total: number;
  completed: number;
  active: number;
}

export function getTaskStatsByUserId(userId: string): TaskStats {
  const db = getDb();
  
  const totalResult = db.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE userId = ?
  `).get(userId) as { count: number };
  
  const completedResult = db.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE userId = ? AND completed = 1
  `).get(userId) as { count: number };
  
  const total = totalResult.count;
  const completed = completedResult.count;
  const active = total - completed;
  
  return {
    total,
    completed,
    active
  };
}
