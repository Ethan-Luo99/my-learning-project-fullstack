import { initDatabase, tableExists, getTableCount, getDbPath } from './db';

let isInitialized = false;
let initializationError: Error | null = null;

export function initializeDatabase(): void {
  if (isInitialized) {
    return;
  }

  try {
    console.log('[DB] 正在初始化数据库...');
    
    initDatabase();
    
    const usersTableExists = tableExists('users');
    const tasksTableExists = tableExists('tasks');
    
    const usersCount = getTableCount('users');
    const tasksCount = getTableCount('tasks');
    
    console.log('[DB] 数据库初始化完成');
    console.log('[DB] 数据库路径:', getDbPath());
    console.log('[DB] users 表:', usersTableExists ? '已创建' : '未创建', `(${usersCount} 条记录)`);
    console.log('[DB] tasks 表:', tasksTableExists ? '已创建' : '未创建', `(${tasksCount} 条记录)`);
    
    isInitialized = true;
    initializationError = null;
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    console.error('[DB] 数据库初始化失败:', initializationError.message);
    throw initializationError;
  }
}

export function isDbInitialized(): boolean {
  return isInitialized;
}

export function getInitializationError(): Error | null {
  return initializationError;
}

initializeDatabase();

export { initializeDatabase as default };
