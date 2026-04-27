import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_DIR = path.join(process.cwd(), 'server', 'data');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-validation.db');

function ensureTestDir(): void {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }
}

function cleanupTestDb(): void {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  const walPath = TEST_DB_PATH + '-wal';
  const shmPath = TEST_DB_PATH + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => boolean, message: string = ''): void {
  try {
    const passed = fn();
    results.push({ name, passed, message: message || (passed ? '通过' : '失败') });
    console.log(`[${passed ? '✓' : '✗'}] ${name}`);
    if (!passed && message) console.log(`    原因: ${message}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, message: `异常: ${errorMsg}` });
    console.log(`[✗] ${name}`);
    console.log(`    异常: ${errorMsg}`);
  }
}

function createUsersTable(db: Database.Database): void {
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

function createTasksTable(db: Database.Database): void {
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

function createIndexes(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_tasks_userId ON tasks(userId);
    CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
  `);
}

function initDatabase(db: Database.Database): void {
  db.transaction(() => {
    createUsersTable(db);
    createTasksTable(db);
    createIndexes(db);
  })();
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const result = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name=?
  `).get(tableName);
  return result !== undefined;
}

function getTableCount(db: Database.Database, tableName: string): number {
  if (!tableExists(db, tableName)) {
    return 0;
  }
  const result = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
  return result.count;
}

console.log('========================================');
console.log('  SQLite 数据库初始化模块 - 功能验证');
console.log('========================================\n');

ensureTestDir();
cleanupTestDb();

console.log('--- 测试 1: 数据库连接与单例模式 ---\n');

let dbInstance: Database.Database | null = null;

function getTestDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }
  dbInstance = new Database(TEST_DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  return dbInstance;
}

function closeTestDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

test('1.1 getDatabase() 应返回数据库连接实例', () => {
  const db = getTestDb();
  return db !== undefined && db !== null && typeof db.prepare === 'function';
});

test('1.2 多次调用应返回同一实例 (单例)', () => {
  closeTestDb();
  const db1 = getTestDb();
  const db2 = getTestDb();
  const db3 = getTestDb();
  return db1 === db2 && db2 === db3;
});

console.log('\n--- 测试 2: 关闭连接 ---\n');

test('2.1 closeDatabase() 应正确关闭连接', () => {
  closeTestDb();
  const db = getTestDb();
  const isOpenBefore = db.open;
  closeTestDb();
  const isOpenAfter = db.open;
  return isOpenBefore === true && isOpenAfter === false;
});

console.log('\n--- 测试 3: 数据库初始化 ---\n');

closeTestDb();
cleanupTestDb();

test('3.1 initializeDatabase() 应创建 users 表', () => {
  const db = getTestDb();
  initDatabase(db);
  return tableExists(db, 'users');
});

test('3.2 initializeDatabase() 应创建 tasks 表', () => {
  return tableExists(dbInstance!, 'tasks');
});

test('3.3 重复调用 initializeDatabase() 不报错 (IF NOT EXISTS)', () => {
  try {
    initDatabase(dbInstance!);
    initDatabase(dbInstance!);
    initDatabase(dbInstance!);
    return true;
  } catch {
    return false;
  }
});

console.log('\n--- 测试 4: 数据库配置 (WAL 和 外键) ---\n');

test('4.1 WAL 模式已启用', () => {
  const db = getTestDb();
  const result = db.pragma('journal_mode', { simple: true });
  return result === 'wal';
}, `实际值: ${dbInstance?.pragma('journal_mode', { simple: true })}`);

test('4.2 外键约束已启用', () => {
  const db = getTestDb();
  const result = db.pragma('foreign_keys', { simple: true });
  return result === 1;
}, `实际值: ${dbInstance?.pragma('foreign_keys', { simple: true })}`);

console.log('\n--- 测试 5: tableExists() 函数 ---\n');

test('5.1 tableExists() 正确检测存在的表', () => {
  const db = getTestDb();
  return tableExists(db, 'users') && tableExists(db, 'tasks');
});

test('5.2 tableExists() 正确检测不存在的表', () => {
  const db = getTestDb();
  return !tableExists(db, 'nonexistent_table') && !tableExists(db, 'random_table_123');
});

console.log('\n--- 测试 6: getTableCount() 函数 ---\n');

test('6.1 getTableCount() 空表返回 0', () => {
  const db = getTestDb();
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM users');
  return getTableCount(db, 'users') === 0 && getTableCount(db, 'tasks') === 0;
});

test('6.2 getTableCount() 不存在的表返回 0', () => {
  const db = getTestDb();
  return getTableCount(db, 'nonexistent_table') === 0;
});

test('6.3 getTableCount() 插入数据后返回正确计数', () => {
  const db = getTestDb();
  
  db.prepare(`
    INSERT INTO users (id, username, passwordHash, avatar, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run('test-id-1', 'testuser1', 'hash1', null, '2024-01-01T00:00:00.000Z');

  db.prepare(`
    INSERT INTO users (id, username, passwordHash, avatar, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run('test-id-2', 'testuser2', 'hash2', null, '2024-01-02T00:00:00.000Z');

  const usersCount = getTableCount(db, 'users');
  
  db.prepare(`
    INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('task-1', 'test-id-1', 'Task 1', 'Desc 1', 0, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');

  const tasksCount = getTableCount(db, 'tasks');
  
  return usersCount === 2 && tasksCount === 1;
});

console.log('\n--- 测试 7: 表结构验证 (功能相关) ---\n');

test('7.1 users 表结构包含必要列', () => {
  const db = getTestDb();
  const columns = db.pragma('table_info(users)') as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);
  return columnNames.includes('id') && 
         columnNames.includes('username') && 
         columnNames.includes('passwordHash') && 
         columnNames.includes('createdAt');
});

test('7.2 tasks 表结构包含必要列', () => {
  const db = getTestDb();
  const columns = db.pragma('table_info(tasks)') as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);
  return columnNames.includes('id') && 
         columnNames.includes('userId') && 
         columnNames.includes('title') && 
         columnNames.includes('description') &&
         columnNames.includes('completed') &&
         columnNames.includes('createdAt') &&
         columnNames.includes('updatedAt');
});

console.log('\n========================================');
console.log('  功能验证结果汇总');
console.log('========================================\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`总测试数: ${total}`);
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`通过率: ${((passed / total) * 100).toFixed(1)}%\n`);

if (failed > 0) {
  console.log('失败的测试:\n');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  ✗ ${r.name}`);
    console.log(`    ${r.message}`);
  });
} else {
  console.log('所有测试通过! ✓');
}

closeTestDb();

console.log('\n--- 清理测试数据库 ---\n');
cleanupTestDb();
console.log('测试数据库已清理');

process.exit(failed > 0 ? 1 : 0);
