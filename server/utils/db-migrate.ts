import path from 'path';
import fs from 'fs';
import { getDb, initDatabase, tableExists, getTableCount, getDbPath } from './db';
import type { UserData, TaskData } from '../lib/database';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

export interface MigrationResult {
  success: boolean;
  users: {
    read: number;
    inserted: number;
    skipped: number;
    errors: string[];
  };
  tasks: {
    read: number;
    inserted: number;
    skipped: number;
    errors: string[];
  };
  totalTime: number;
  error?: string;
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

function normalizeTaskData(task: Record<string, unknown>): TaskData {
  return {
    id: String(task.id || ''),
    userId: String(task.userId || 'default'),
    title: String(task.title || ''),
    description: String(task.description || ''),
    completed: Boolean(task.completed),
    createdAt: String(task.createdAt || new Date().toISOString()),
    updatedAt: String(task.updatedAt || new Date().toISOString())
  };
}

function userExists(db: ReturnType<typeof getDb>, id: string): boolean {
  const result = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  return result !== undefined;
}

function taskExists(db: ReturnType<typeof getDb>, id: string): boolean {
  const result = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  return result !== undefined;
}

function insertUser(db: ReturnType<typeof getDb>, user: UserData): void {
  db.prepare(`
    INSERT INTO users (id, username, passwordHash, avatar, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.id, user.username, user.passwordHash, user.avatar, user.createdAt);
}

function insertTask(db: ReturnType<typeof getDb>, task: TaskData): void {
  const completedInt = task.completed ? 1 : 0;
  
  db.prepare(`
    INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(task.id, task.userId, task.title, task.description, completedInt, task.createdAt, task.updatedAt);
}

export function migrateUsers(db: ReturnType<typeof getDb>): { read: number; inserted: number; skipped: number; errors: string[] } {
  const result = {
    read: 0,
    inserted: 0,
    skipped: 0,
    errors: [] as string[]
  };
  
  const users = readJsonFile<UserData>(USERS_FILE);
  result.read = users.length;
  
  console.log(`[Migration] 读取到 ${users.length} 个用户数据`);
  
  for (const user of users) {
    try {
      if (userExists(db, user.id)) {
        result.skipped++;
        console.log(`[Migration] 用户 ${user.username} (${user.id}) 已存在，跳过`);
      } else {
        insertUser(db, user);
        result.inserted++;
        console.log(`[Migration] 成功插入用户: ${user.username}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`用户 ${user.username}: ${errorMsg}`);
      console.error(`[Migration] 插入用户 ${user.username} 失败:`, errorMsg);
    }
  }
  
  return result;
}

export function migrateTasks(db: ReturnType<typeof getDb>): { read: number; inserted: number; skipped: number; errors: string[] } {
  const result = {
    read: 0,
    inserted: 0,
    skipped: 0,
    errors: [] as string[]
  };
  
  const rawTasks = readJsonFile<Record<string, unknown>>(TASKS_FILE);
  result.read = rawTasks.length;
  
  console.log(`[Migration] 读取到 ${rawTasks.length} 个任务数据`);
  
  for (const rawTask of rawTasks) {
    try {
      const task = normalizeTaskData(rawTask);
      
      if (taskExists(db, task.id)) {
        result.skipped++;
        console.log(`[Migration] 任务 ${task.id} 已存在，跳过`);
      } else {
        insertTask(db, task);
        result.inserted++;
        console.log(`[Migration] 成功插入任务: ${task.id} (${task.title})`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`任务 ${String(rawTask.id)}: ${errorMsg}`);
      console.error(`[Migration] 插入任务失败:`, errorMsg);
    }
  }
  
  return result;
}

export function runMigration(options: { 
  force?: boolean;
  silent?: boolean;
} = {}): MigrationResult {
  const startTime = Date.now();
  const { force = false, silent = false } = options;
  
  const result: MigrationResult = {
    success: false,
    users: { read: 0, inserted: 0, skipped: 0, errors: [] },
    tasks: { read: 0, inserted: 0, skipped: 0, errors: [] },
    totalTime: 0
  };
  
  try {
    if (!silent) {
      console.log('========================================');
      console.log('        开始数据迁移 (JSON → SQLite)');
      console.log('========================================');
    }
    
    if (!silent) {
      console.log('\n[1/3] 初始化数据库...');
    }
    initDatabase();
    
    if (!silent) {
      console.log('[1/3] 数据库初始化完成');
    }
    
    const db = getDb();
    
    const usersBefore = getTableCount('users');
    const tasksBefore = getTableCount('tasks');
    
    if (!silent) {
      console.log(`\n[2/3] 迁移用户数据...`);
      console.log(`      迁移前: ${usersBefore} 个用户`);
    }
    
    const migrate = db.transaction(() => {
      const userResult = migrateUsers(db);
      result.users = userResult;
      
      if (!silent) {
        console.log(`\n[3/3] 迁移任务数据...`);
        console.log(`      迁移前: ${tasksBefore} 个任务`);
      }
      
      const taskResult = migrateTasks(db);
      result.tasks = taskResult;
    });
    
    migrate();
    
    const usersAfter = getTableCount('users');
    const tasksAfter = getTableCount('tasks');
    
    result.totalTime = Date.now() - startTime;
    result.success = true;
    
    if (!silent) {
      console.log('\n========================================');
      console.log('        数据迁移完成');
      console.log('========================================');
      console.log(`\n📊 迁移统计:`);
      console.log(`   👤 用户:`);
      console.log(`      - 读取: ${result.users.read} 条`);
      console.log(`      - 插入: ${result.users.inserted} 条`);
      console.log(`      - 跳过: ${result.users.skipped} 条`);
      console.log(`      - 错误: ${result.users.errors.length} 条`);
      console.log(`      - 迁移前: ${usersBefore} 条`);
      console.log(`      - 迁移后: ${usersAfter} 条`);
      console.log(`   📋 任务:`);
      console.log(`      - 读取: ${result.tasks.read} 条`);
      console.log(`      - 插入: ${result.tasks.inserted} 条`);
      console.log(`      - 跳过: ${result.tasks.skipped} 条`);
      console.log(`      - 错误: ${result.tasks.errors.length} 条`);
      console.log(`      - 迁移前: ${tasksBefore} 条`);
      console.log(`      - 迁移后: ${tasksAfter} 条`);
      console.log(`\n⏱️ 总耗时: ${result.totalTime}ms`);
      console.log(`💾 数据库: ${getDbPath()}`);
      
      if (result.users.errors.length > 0 || result.tasks.errors.length > 0) {
        console.log('\n⚠️ 迁移过程中遇到错误:');
        result.users.errors.forEach(err => console.log(`   用户错误: ${err}`));
        result.tasks.errors.forEach(err => console.log(`   任务错误: ${err}`));
      }
    }
    
    return result;
  } catch (error) {
    result.totalTime = Date.now() - startTime;
    result.error = error instanceof Error ? error.message : String(error);
    result.success = false;
    
    if (!silent) {
      console.error('\n❌ 迁移失败:', result.error);
    }
    
    return result;
  }
}

export default runMigration;
