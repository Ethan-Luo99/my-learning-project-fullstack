import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'server', 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');

let dbInstance: Database.Database | null = null;

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
