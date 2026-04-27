import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

export interface UserData {
  id: string;
  username: string;
  passwordHash: string;
  avatar: string | null;
  createdAt: string;
}

export interface TaskData {
  id: string;
  userId: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

let usersCache: UserData[] | null = null;
let tasksCache: TaskData[] | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readUsers(): UserData[] {
  if (usersCache !== null) {
    return usersCache;
  }
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) {
    usersCache = [];
    return usersCache;
  }
  try {
    const content = fs.readFileSync(USERS_FILE, 'utf-8');
    usersCache = JSON.parse(content) as UserData[];
    return usersCache;
  } catch {
    usersCache = [];
    return usersCache;
  }
}

export function writeUsers(users: UserData[]): void {
  ensureDataDir();
  usersCache = users;
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function readTasks(): TaskData[] {
  if (tasksCache !== null) {
    return tasksCache;
  }
  ensureDataDir();
  if (!fs.existsSync(TASKS_FILE)) {
    tasksCache = [];
    return tasksCache;
  }
  try {
    const content = fs.readFileSync(TASKS_FILE, 'utf-8');
    const parsed = JSON.parse(content) as Array<TaskData | Record<string, unknown>>;
    tasksCache = parsed.map(item => {
      if ('userId' in item) {
        return item as TaskData;
      }
      return {
        ...item,
        userId: 'default',
        completed: Boolean(item.completed)
      } as TaskData;
    });
    return tasksCache;
  } catch {
    tasksCache = [];
    return tasksCache;
  }
}

function writeTasks(tasks: TaskData[]): void {
  ensureDataDir();
  tasksCache = tasks;
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

export function findUserByUsername(username: string): UserData | undefined {
  const users = readUsers();
  return users.find(u => u.username === username);
}

export function findUserById(id: string): UserData | undefined {
  const users = readUsers();
  return users.find(u => u.id === id);
}

export function createUser(user: UserData): void {
  const users = readUsers();
  users.push(user);
  writeUsers(users);
}

export function updateUser(userId: string, updates: Partial<UserData>): UserData | undefined {
  const users = readUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return undefined;
  
  users[index] = { ...users[index], ...updates };
  writeUsers(users);
  return users[index];
}

export function findTasksByUserId(userId: string): TaskData[] {
  const tasks = readTasks();
  return tasks
    .filter(t => t.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function findTaskById(taskId: string): TaskData | undefined {
  const tasks = readTasks();
  return tasks.find(t => t.id === taskId);
}

export function createTask(task: TaskData): void {
  const tasks = readTasks();
  tasks.push(task);
  writeTasks(tasks);
}

export function updateTask(taskId: string, updates: Partial<TaskData>): TaskData | undefined {
  const tasks = readTasks();
  const index = tasks.findIndex(t => t.id === taskId);
  if (index === -1) return undefined;
  
  tasks[index] = { ...tasks[index], ...updates };
  writeTasks(tasks);
  return tasks[index];
}

export function deleteTask(taskId: string): boolean {
  const tasks = readTasks();
  const index = tasks.findIndex(t => t.id === taskId);
  if (index === -1) return false;
  
  tasks.splice(index, 1);
  writeTasks(tasks);
  return true;
}
