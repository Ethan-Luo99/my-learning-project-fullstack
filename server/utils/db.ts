import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'server', 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const TASKS_FILE = path.join(DB_DIR, 'tasks.json');

let dbInstance: Database.Database | null = null;
let isInitialized = false;

interface UserData {
  id: string;
  username: string;
  passwordHash: string;
  avatar: string | null;
  createdAt: string;
}

interface TaskData {
  id: string;
  userId: string;
  title: string;
  description: string;
  completed: number;
  createdAt: string;
  updatedAt: string;
}

function readJsonFile<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T[];
  } catch {
    return [];
  }
}

function migrateUsersFromJson(db: Database.Database): void {
  const users = readJsonFile<UserData>(USERS_FILE);
  
  if (users.length === 0) {
    return;
  }
  
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  
  if (existingCount.count === 0) {
    console.log(`[DB Migrate] 正在从 users.json 迁移 ${users.length} 个用户...`);
    
    for (const user of users) {
      try {
        db.prepare(`
          INSERT INTO users (id, username, passwordHash, avatar, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `).run(user.id, user.username, user.passwordHash, user.avatar, user.createdAt);
        console.log(`[DB Migrate] ✓ 已创建用户: ${user.username}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[DB Migrate] ✗ 创建用户 ${user.username} 失败: ${errorMsg}`);
      }
    }
    
    console.log(`[DB Migrate] 用户数据迁移完成`);
  } else {
    const adminUserFromJson = users.find(u => u.username === 'admin');
    if (adminUserFromJson) {
      const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
      if (existingAdmin) {
        db.prepare(`
          UPDATE users 
          SET passwordHash = ?
          WHERE username = 'admin'
        `).run(adminUserFromJson.passwordHash);
        console.log(`[DB Migrate] ✓ 已更新 admin 用户密码`);
      }
    }
  }
}

function migrateTasksFromJson(db: Database.Database): void {
  const tasks = readJsonFile<TaskData>(TASKS_FILE);
  
  if (tasks.length === 0) {
    return;
  }
  
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  
  if (existingCount.count > 0) {
    return;
  }
  
  console.log(`[DB Migrate] 正在从 tasks.json 迁移 ${tasks.length} 个任务...`);
  
  for (const task of tasks) {
    try {
      db.prepare(`
        INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id,
        task.userId,
        task.title,
        task.description,
        task.completed,
        task.createdAt,
        task.updatedAt
      );
      console.log(`[DB Migrate] ✓ 已创建任务: ${task.title}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[DB Migrate] ✗ 创建任务失败: ${errorMsg}`);
    }
  }
  
  console.log(`[DB Migrate] 任务数据迁移完成`);
}

export function ensureDbDir(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }
  
  ensureDbDir();
  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  
  if (!isInitialized) {
    console.log('[DB] 首次访问数据库，正在初始化...');
    initDatabase();
    migrateUsersFromJson(dbInstance);
    migrateTasksFromJson(dbInstance);
    isInitialized = true;
    console.log('[DB] 数据库初始化完成');
  }
  
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function tableExists(tableName: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name=?
  `).get(tableName);
  
  return result !== undefined;
}

export function getTableCount(tableName: string): number {
  if (!tableExists(tableName)) {
    return 0;
  }
  
  const db = getDb();
  const result = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
  
  return result.count;
}

export function createUsersTable(): void {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      avatar TEXT NULL,
      createdAt TEXT NOT NULL
    )
  `);
}

export function createTasksTable(): void {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      completed INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

export function createIndexes(): void {
  const db = getDb();
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    
    CREATE INDEX IF NOT EXISTS idx_tasks_userId ON tasks(userId);
    CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
  `);
}

export function initDatabase(): void {
  const db = getDb();
  
  db.transaction(() => {
    createUsersTable();
    createTasksTable();
    createIndexes();
  })();
}

export function getDbPath(): string {
  return DB_PATH;
}
