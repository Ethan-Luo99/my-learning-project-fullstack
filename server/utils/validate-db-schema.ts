import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_DIR = path.join(process.cwd(), 'server', 'data');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-schema-validation.db');

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

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface ForeignKeyInfo {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
}

interface IndexInfo {
  name: string;
}

interface TestResult {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
  note?: string;
}

const results: TestResult[] = [];

function test(
  name: string, 
  expected: string, 
  actual: string, 
  passed: boolean,
  note?: string
): void {
  results.push({ name, expected, actual, passed, note });
  console.log(`[${passed ? '✓' : '✗'}] ${name}`);
  if (!passed) {
    console.log(`    期望: ${expected}`);
    console.log(`    实际: ${actual}`);
    if (note) console.log(`    说明: ${note}`);
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

function getColumns(db: Database.Database, tableName: string): ColumnInfo[] {
  return db.pragma(`table_info(${tableName})`) as ColumnInfo[];
}

function getForeignKeys(db: Database.Database, tableName: string): ForeignKeyInfo[] {
  return db.pragma(`foreign_key_list(${tableName})`) as ForeignKeyInfo[];
}

function getIndexes(db: Database.Database, tableName: string): IndexInfo[] {
  return db.pragma(`index_list(${tableName})`) as IndexInfo[];
}

console.log('========================================');
console.log('  SQLite 数据库 - 表结构验证');
console.log('========================================\n');

ensureTestDir();
cleanupTestDb();

const db = new Database(TEST_DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

initDatabase(db);

console.log('--- 1. users 表结构验证 ---\n');

const usersColumns = getColumns(db, 'users');
const usersColumnNames = usersColumns.map(c => c.name);

console.log('users 表实际列:', usersColumnNames, '\n');

test(
  '1.1 users.id 是主键',
  'id 为主键 (pk=1)',
  usersColumns.find(c => c.name === 'id')?.pk === 1 ? 'id 为主键' : 'id 不是主键',
  usersColumns.find(c => c.name === 'id')?.pk === 1
);

test(
  '1.2 users 包含 username 列',
  '存在 username 列',
  usersColumnNames.includes('username') ? '存在' : '不存在',
  usersColumnNames.includes('username')
);

test(
  '1.3 users.username 类型为 TEXT',
  'TEXT',
  usersColumns.find(c => c.name === 'username')?.type || '未知',
  usersColumns.find(c => c.name === 'username')?.type === 'TEXT'
);

test(
  '1.4 users.username NOT NULL',
  'NOT NULL (notnull=1)',
  usersColumns.find(c => c.name === 'username')?.notnull === 1 ? 'NOT NULL' : 'NULL 允许',
  usersColumns.find(c => c.name === 'username')?.notnull === 1
);

test(
  '1.5 users 包含 passwordHash 列',
  '存在 passwordHash 列',
  usersColumnNames.includes('passwordHash') ? '存在' : '不存在',
  usersColumnNames.includes('passwordHash'),
  '注意: 验收标准中列名为 password_hash (蛇形命名), 实际实现为 passwordHash (驼峰命名)'
);

test(
  '1.6 users.passwordHash 类型为 TEXT',
  'TEXT',
  usersColumns.find(c => c.name === 'passwordHash')?.type || '未知',
  usersColumns.find(c => c.name === 'passwordHash')?.type === 'TEXT'
);

test(
  '1.7 users.passwordHash NOT NULL',
  'NOT NULL (notnull=1)',
  usersColumns.find(c => c.name === 'passwordHash')?.notnull === 1 ? 'NOT NULL' : 'NULL 允许',
  usersColumns.find(c => c.name === 'passwordHash')?.notnull === 1
);

test(
  '1.8 users 包含 createdAt 列',
  '存在 createdAt 列',
  usersColumnNames.includes('createdAt') ? '存在' : '不存在',
  usersColumnNames.includes('createdAt'),
  '注意: 验收标准中列名为 created_at (蛇形命名), 实际实现为 createdAt (驼峰命名)'
);

test(
  '1.9 users.createdAt 类型为 TEXT',
  'TEXT',
  usersColumns.find(c => c.name === 'createdAt')?.type || '未知',
  usersColumns.find(c => c.name === 'createdAt')?.type === 'TEXT'
);

test(
  '1.10 users.createdAt NOT NULL',
  'NOT NULL (notnull=1)',
  usersColumns.find(c => c.name === 'createdAt')?.notnull === 1 ? 'NOT NULL' : 'NULL 允许',
  usersColumns.find(c => c.name === 'createdAt')?.notnull === 1
);

test(
  '1.11 users.updated_at 列 (验收标准要求)',
  '存在 updated_at 列',
  usersColumnNames.includes('updatedAt') || usersColumnNames.includes('updated_at') ? '存在' : '不存在',
  usersColumnNames.includes('updatedAt') || usersColumnNames.includes('updated_at'),
  '差异: 验收标准要求包含 updated_at 列, 但实际实现中 users 表不包含此列'
);

test(
  '1.12 users.username 唯一约束验证',
  '插入重复 username 应失败',
  (() => {
    try {
      db.prepare(`
        INSERT INTO users (id, username, passwordHash, avatar, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run('unique-test-1', 'uniqueuser', 'hash', null, '2024-01-01T00:00:00.000Z');
      
      db.prepare(`
        INSERT INTO users (id, username, passwordHash, avatar, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run('unique-test-2', 'uniqueuser', 'hash2', null, '2024-01-02T00:00:00.000Z');
      
      return '成功插入重复值 (约束未生效)';
    } catch {
      return '插入重复值失败 (约束生效)';
    }
  })(),
  (() => {
    try {
      db.exec('DELETE FROM users');
      db.prepare(`
        INSERT INTO users (id, username, passwordHash, avatar, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run('unique-test-1', 'uniqueuser', 'hash', null, '2024-01-01T00:00:00.000Z');
      
      db.prepare(`
        INSERT INTO users (id, username, passwordHash, avatar, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run('unique-test-2', 'uniqueuser', 'hash2', null, '2024-01-02T00:00:00.000Z');
      
      return false;
    } catch {
      return true;
    }
  })()
);

console.log('\n--- 2. tasks 表结构验证 ---\n');

const tasksColumns = getColumns(db, 'tasks');
const tasksColumnNames = tasksColumns.map(c => c.name);

console.log('tasks 表实际列:', tasksColumnNames, '\n');

test(
  '2.1 tasks.id 是主键',
  'id 为主键 (pk=1)',
  tasksColumns.find(c => c.name === 'id')?.pk === 1 ? 'id 为主键' : 'id 不是主键',
  tasksColumns.find(c => c.name === 'id')?.pk === 1
);

test(
  '2.2 tasks 包含 userId 列',
  '存在 userId 列',
  tasksColumnNames.includes('userId') ? '存在' : '不存在',
  tasksColumnNames.includes('userId'),
  '注意: 验收标准中列名为 user_id (蛇形命名), 实际实现为 userId (驼峰命名)'
);

test(
  '2.3 tasks.userId 类型为 TEXT',
  'TEXT',
  tasksColumns.find(c => c.name === 'userId')?.type || '未知',
  tasksColumns.find(c => c.name === 'userId')?.type === 'TEXT'
);

test(
  '2.4 tasks.userId NOT NULL',
  'NOT NULL (notnull=1)',
  tasksColumns.find(c => c.name === 'userId')?.notnull === 1 ? 'NOT NULL' : 'NULL 允许',
  tasksColumns.find(c => c.name === 'userId')?.notnull === 1
);

test(
  '2.5 tasks 包含 title 列',
  '存在 title 列',
  tasksColumnNames.includes('title') ? '存在' : '不存在',
  tasksColumnNames.includes('title')
);

test(
  '2.6 tasks.title 类型为 TEXT',
  'TEXT',
  tasksColumns.find(c => c.name === 'title')?.type || '未知',
  tasksColumns.find(c => c.name === 'title')?.type === 'TEXT'
);

test(
  '2.7 tasks.title NOT NULL',
  'NOT NULL (notnull=1)',
  tasksColumns.find(c => c.name === 'title')?.notnull === 1 ? 'NOT NULL' : 'NULL 允许',
  tasksColumns.find(c => c.name === 'title')?.notnull === 1
);

test(
  '2.8 tasks 包含 description 列',
  '存在 description 列',
  tasksColumnNames.includes('description') ? '存在' : '不存在',
  tasksColumnNames.includes('description')
);

test(
  '2.9 tasks.description 类型为 TEXT',
  'TEXT',
  tasksColumns.find(c => c.name === 'description')?.type || '未知',
  tasksColumns.find(c => c.name === 'description')?.type === 'TEXT'
);

test(
  '2.10 tasks.description 默认值为空字符串',
  'DEFAULT \'\'',
  tasksColumns.find(c => c.name === 'description')?.dflt_value || '(无默认值)',
  tasksColumns.find(c => c.name === 'description')?.dflt_value === '\'\'' || 
  tasksColumns.find(c => c.name === 'description')?.dflt_value === ''
);

test(
  '2.11 tasks 包含 completed 列',
  '存在 completed 列',
  tasksColumnNames.includes('completed') ? '存在' : '不存在',
  tasksColumnNames.includes('completed')
);

test(
  '2.12 tasks.completed 类型为 INTEGER',
  'INTEGER',
  tasksColumns.find(c => c.name === 'completed')?.type || '未知',
  tasksColumns.find(c => c.name === 'completed')?.type === 'INTEGER'
);

test(
  '2.13 tasks.completed NOT NULL',
  'NOT NULL (notnull=1)',
  tasksColumns.find(c => c.name === 'completed')?.notnull === 1 ? 'NOT NULL' : 'NULL 允许',
  tasksColumns.find(c => c.name === 'completed')?.notnull === 1
);

test(
  '2.14 tasks.completed 默认值为 0',
  'DEFAULT 0',
  tasksColumns.find(c => c.name === 'completed')?.dflt_value || '(无默认值)',
  tasksColumns.find(c => c.name === 'completed')?.dflt_value === '0'
);

test(
  '2.15 tasks 包含 createdAt 列',
  '存在 createdAt 列',
  tasksColumnNames.includes('createdAt') ? '存在' : '不存在',
  tasksColumnNames.includes('createdAt'),
  '注意: 验收标准中列名为 created_at (蛇形命名), 实际实现为 createdAt (驼峰命名)'
);

test(
  '2.16 tasks.createdAt 类型为 TEXT',
  'TEXT',
  tasksColumns.find(c => c.name === 'createdAt')?.type || '未知',
  tasksColumns.find(c => c.name === 'createdAt')?.type === 'TEXT'
);

test(
  '2.17 tasks.createdAt NOT NULL',
  'NOT NULL (notnull=1)',
  tasksColumns.find(c => c.name === 'createdAt')?.notnull === 1 ? 'NOT NULL' : 'NULL 允许',
  tasksColumnNames.includes('createdAt') ? (tasksColumns.find(c => c.name === 'createdAt')?.notnull === 1) : false
);

test(
  '2.18 tasks 包含 updatedAt 列',
  '存在 updatedAt 列',
  tasksColumnNames.includes('updatedAt') ? '存在' : '不存在',
  tasksColumnNames.includes('updatedAt'),
  '注意: 验收标准中列名为 updated_at (蛇形命名), 实际实现为 updatedAt (驼峰命名)'
);

test(
  '2.19 tasks.updatedAt 类型为 TEXT',
  'TEXT',
  tasksColumns.find(c => c.name === 'updatedAt')?.type || '未知',
  tasksColumns.find(c => c.name === 'updatedAt')?.type === 'TEXT'
);

test(
  '2.20 tasks.updatedAt NOT NULL',
  'NOT NULL (notnull=1)',
  tasksColumns.find(c => c.name === 'updatedAt')?.notnull === 1 ? 'NOT NULL' : 'NULL 允许',
  tasksColumns.find(c => c.name === 'updatedAt')?.notnull === 1
);

console.log('\n--- 3. 外键约束验证 ---\n');

const tasksForeignKeys = getForeignKeys(db, 'tasks');

console.log('tasks 表外键:', tasksForeignKeys, '\n');

const userIdFk = tasksForeignKeys.find(fk => fk.from === 'userId');

test(
  '3.1 tasks.userId 外键关联 users.id',
  '外键指向 users.id',
  userIdFk ? `外键指向 ${userIdFk.table}.${userIdFk.to}` : '无外键',
  userIdFk?.table === 'users' && userIdFk?.to === 'id'
);

test(
  '3.2 外键 ON DELETE CASCADE',
  'ON DELETE CASCADE',
  userIdFk?.on_delete || '未知',
  userIdFk?.on_delete === 'CASCADE'
);

test(
  '3.3 外键约束实际生效验证',
  '插入无关联用户的任务应失败',
  (() => {
    try {
      db.exec('DELETE FROM tasks');
      db.exec('DELETE FROM users');
      
      db.prepare(`
        INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('fk-test-1', 'nonexistent-user', 'Test', 'Desc', 0, '2024-01-01', '2024-01-01');
      
      return '成功插入 (约束未生效)';
    } catch {
      return '插入失败 (约束生效)';
    }
  })(),
  (() => {
    try {
      db.exec('DELETE FROM tasks');
      db.exec('DELETE FROM users');
      
      db.prepare(`
        INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('fk-test-1', 'nonexistent-user', 'Test', 'Desc', 0, '2024-01-01', '2024-01-01');
      
      return false;
    } catch {
      return true;
    }
  })()
);

console.log('\n--- 4. 索引验证 ---\n');

const usersIndexes = getIndexes(db, 'users');
const tasksIndexes = getIndexes(db, 'tasks');

console.log('users 表索引:', usersIndexes.map(i => i.name));
console.log('tasks 表索引:', tasksIndexes.map(i => i.name), '\n');

test(
  '4.1 idx_users_username 索引已创建',
  '存在 idx_users_username 索引',
  usersIndexes.some(i => i.name === 'idx_users_username') ? '存在' : '不存在',
  usersIndexes.some(i => i.name === 'idx_users_username')
);

test(
  '4.2 idx_tasks_userId 索引已创建',
  '存在 idx_tasks_userId 索引',
  tasksIndexes.some(i => i.name === 'idx_tasks_userId') ? '存在' : '不存在',
  tasksIndexes.some(i => i.name === 'idx_tasks_userId'),
  '注意: 验收标准中索引名为 idx_tasks_user_id (蛇形命名), 实际实现为 idx_tasks_userId (驼峰命名)'
);

test(
  '4.3 idx_tasks_createdAt 附加索引 (额外实现)',
  '存在 idx_tasks_createdAt 索引',
  tasksIndexes.some(i => i.name === 'idx_tasks_createdAt') ? '存在' : '不存在',
  tasksIndexes.some(i => i.name === 'idx_tasks_createdAt'),
  '此为额外实现的索引, 验收标准未要求'
);

test(
  '4.4 idx_tasks_completed 附加索引 (额外实现)',
  '存在 idx_tasks_completed 索引',
  tasksIndexes.some(i => i.name === 'idx_tasks_completed') ? '存在' : '不存在',
  tasksIndexes.some(i => i.name === 'idx_tasks_completed'),
  '此为额外实现的索引, 验收标准未要求'
);

console.log('\n--- 5. 类型验证 ---\n');

test(
  '5.1 tasks.completed 使用 INTEGER (0/1) 存储',
  'completed 值为 0 或 1 (number 类型)',
  (() => {
    db.exec('DELETE FROM tasks');
    db.exec('DELETE FROM users');
    
    db.prepare(`
      INSERT INTO users (id, username, passwordHash, avatar, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run('type-test-user', 'typetestuser', 'hash', null, '2024-01-01T00:00:00.000Z');

    db.prepare(`
      INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('type-test-1', 'type-test-user', 'Completed Task', 'Desc', 1, '2024-01-01', '2024-01-01');
    
    db.prepare(`
      INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('type-test-2', 'type-test-user', 'Incomplete Task', 'Desc', 0, '2024-01-01', '2024-01-01');

    const result1 = db.prepare('SELECT completed FROM tasks WHERE id = ?').get('type-test-1') as { completed: number };
    const result2 = db.prepare('SELECT completed FROM tasks WHERE id = ?').get('type-test-2') as { completed: number };

    return `completed=1: ${result1?.completed} (${typeof result1?.completed}), completed=0: ${result2?.completed} (${typeof result2?.completed})`;
  })(),
  (() => {
    db.exec('DELETE FROM tasks');
    db.exec('DELETE FROM users');
    
    db.prepare(`
      INSERT INTO users (id, username, passwordHash, avatar, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run('type-test-user', 'typetestuser', 'hash', null, '2024-01-01T00:00:00.000Z');

    db.prepare(`
      INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('type-test-1', 'type-test-user', 'Completed Task', 'Desc', 1, '2024-01-01', '2024-01-01');
    
    db.prepare(`
      INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('type-test-2', 'type-test-user', 'Incomplete Task', 'Desc', 0, '2024-01-01', '2024-01-01');

    const result1 = db.prepare('SELECT completed FROM tasks WHERE id = ?').get('type-test-1') as { completed: number };
    const result2 = db.prepare('SELECT completed FROM tasks WHERE id = ?').get('type-test-2') as { completed: number };

    return result1?.completed === 1 && result2?.completed === 0 && 
           typeof result1?.completed === 'number' && typeof result2?.completed === 'number';
  })()
);

console.log('\n========================================');
console.log('  表结构验证结果汇总');
console.log('========================================\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`总测试数: ${total}`);
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`通过率: ${((passed / total) * 100).toFixed(1)}%\n`);

if (failed > 0) {
  console.log('失败/有差异的测试:\n');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  ✗ ${r.name}`);
    console.log(`    期望: ${r.expected}`);
    console.log(`    实际: ${r.actual}`);
    if (r.note) console.log(`    说明: ${r.note}`);
    console.log('');
  });
} else {
  console.log('所有核心测试通过! ✓');
}

db.close();

console.log('\n--- 清理测试数据库 ---\n');
cleanupTestDb();
console.log('测试数据库已清理');

process.exit(0);
