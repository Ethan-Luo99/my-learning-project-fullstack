import { initDatabase, getDb, getTableCount, getDbPath } from '../server/utils/db';
import { createUserFromData } from '../server/utils/userStorage';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

interface UserData {
  id: string;
  username: string;
  passwordHash: string;
  avatar: string | null;
  createdAt: string;
}

interface UserOperation {
  action: 'insert' | 'skip';
  user: UserData;
}

interface MigrationResult {
  success: boolean;
  backupPath?: string;
  users: {
    read: number;
    inserted: number;
    skipped: number;
    errors: string[];
  };
  totalTime: number;
  error?: string;
}

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function createBackup(sourceFile: string, type: string): string | undefined {
  if (!fs.existsSync(sourceFile)) {
    console.log(`[信息] 源文件不存在，跳过备份: ${sourceFile}`);
    return undefined;
  }

  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = path.basename(sourceFile);
  const backupFileName = `${fileName}.${timestamp}.bak`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  try {
    fs.copyFileSync(sourceFile, backupPath);
    console.log(`[备份] 已创建 ${type} 数据备份: ${backupPath}`);
    return backupPath;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[警告] 创建备份失败: ${errorMsg}`);
    return undefined;
  }
}

function readJsonFile<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    console.log(`[警告] 文件不存在: ${filePath}`);
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T[];
  } catch (error) {
    console.error(`[错误] 读取文件失败 ${filePath}:`, error);
    return [];
  }
}

function userExists(db: ReturnType<typeof getDb>, id: string): boolean {
  const result = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  return result !== undefined;
}

export function runMigration(): MigrationResult {
  const startTime = Date.now();

  const result: MigrationResult = {
    success: false,
    users: { read: 0, inserted: 0, skipped: 0, errors: [] },
    totalTime: 0
  };

  const operations: UserOperation[] = [];

  try {
    console.log('========================================');
    console.log('   用户数据迁移: JSON → SQLite');
    console.log('========================================');

    console.log('\n[1/5] 创建数据备份...');
    const backupPath = createBackup(USERS_FILE, '用户');
    result.backupPath = backupPath;
    if (backupPath) {
      console.log('      ✓ 备份创建成功');
    } else {
      console.log('      ⚠️ 未创建备份（源文件可能不存在）');
    }

    console.log('\n[2/5] 初始化数据库...');
    initDatabase();
    console.log('      ✓ 数据库初始化完成');
    console.log(`      数据库路径: ${getDbPath()}`);

    const db = getDb();

    const usersBefore = getTableCount('users');

    console.log(`\n[3/5] 读取 JSON 数据文件...`);
    console.log(`      数据源: ${DATA_DIR}`);

    const users = readJsonFile<UserData>(USERS_FILE);

    result.users.read = users.length;

    console.log(`      ✓ 读取到 ${users.length} 个用户`);

    console.log('\n[4/5] 开始数据迁移 (事务保护)...');
    console.log(`      迁移前 users 表: ${usersBefore} 条`);

    const migrate = db.transaction(() => {
      for (const user of users) {
        try {
          if (userExists(db, user.id)) {
            result.users.skipped++;
            operations.push({ action: 'skip', user });
          } else {
            createUserFromData(user);
            result.users.inserted++;
            operations.push({ action: 'insert', user });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.users.errors.push(`用户 ${user.username}: ${errorMsg}`);
          throw error;
        }
      }
    });

    migrate();
    console.log('\n      ✓ 事务提交成功');

    console.log('\n      迁移操作详情:');
    for (const op of operations) {
      if (op.action === 'insert') {
        console.log(`        [插入] 用户: ${op.user.username}`);
      } else {
        console.log(`        [跳过] 用户已存在: ${op.user.username} (${op.user.id})`);
      }
    }

    console.log('\n[5/5] 验证迁移结果...');

    const usersAfter = getTableCount('users');

    const usersExpected = usersBefore + result.users.inserted;

    const usersMatch = usersAfter === usersExpected;

    if (usersMatch) {
      console.log(`      ✓ users 表计数验证通过: ${usersAfter} 条`);
    } else {
      console.log(`      ✗ users 表计数不匹配: 期望 ${usersExpected}, 实际 ${usersAfter}`);
    }

    result.totalTime = Date.now() - startTime;
    result.success = usersMatch && result.users.errors.length === 0;

    console.log('\n========================================');
    console.log('   迁移结果汇总');
    console.log('========================================');

    if (result.backupPath) {
      console.log(`\n💾 数据备份: ${result.backupPath}`);
    }

    console.log('\n📊 用户数据:');
    console.log(`   读取: ${result.users.read} 条`);
    console.log(`   插入: ${result.users.inserted} 条`);
    console.log(`   跳过: ${result.users.skipped} 条`);
    console.log(`   错误: ${result.users.errors.length} 条`);
    console.log(`   迁移前: ${usersBefore} 条`);
    console.log(`   迁移后: ${usersAfter} 条`);

    console.log(`\n⏱️ 总耗时: ${result.totalTime}ms`);

    if (result.users.errors.length > 0) {
      console.log('\n⚠️ 迁移过程中遇到错误:');
      result.users.errors.forEach(err => console.log(`   用户错误: ${err}`));
    }

    if (result.success) {
      console.log('\n✅ 迁移成功!');
    } else {
      console.log('\n❌ 迁移存在问题，请检查上述错误。');
      if (result.backupPath) {
        console.log(`   💡 如需回滚，可从备份恢复: ${result.backupPath}`);
      }
    }

    return result;
  } catch (error) {
    result.totalTime = Date.now() - startTime;
    result.error = error instanceof Error ? error.message : String(error);
    result.success = false;

    console.error('\n========================================');
    console.error('   迁移失败');
    console.error('========================================');
    console.error(`\n❌ 错误: ${result.error}`);
    console.error(result.error instanceof Error ? result.error.stack : '');

    if (operations.length > 0) {
      console.log('\n⚠️ 重要提示: 事务已回滚，以下操作并未实际执行:');
      for (const op of operations) {
        if (op.action === 'insert') {
          console.log(`   [未执行] 插入用户: ${op.user.username}`);
        }
      }
    }

    if (result.backupPath) {
      console.log(`\n💾 数据备份保留在: ${result.backupPath}`);
    }

    return result;
  }
}

function getCurrentFilePath(): string | undefined {
  try {
    if (typeof import.meta.url !== 'undefined') {
      return fileURLToPath(import.meta.url);
    }
  } catch {
    // 忽略错误
  }
  return undefined;
}

function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

function isMainModule(): boolean {
  const currentFile = getCurrentFilePath();
  if (!currentFile) {
    return false;
  }

  const normalizedCurrentFile = normalizePath(currentFile);

  if (process.argv[1]) {
    const argvPath = normalizePath(process.argv[1]);
    if (argvPath === normalizedCurrentFile) {
      return true;
    }

    const baseName = path.basename(normalizedCurrentFile, '.ts');
    if (argvPath.includes(baseName) && !argvPath.includes('node_modules')) {
      return true;
    }
  }

  if (typeof __filename !== 'undefined') {
    const normalizedFilename = normalizePath(__filename);
    if (normalizedFilename === normalizedCurrentFile) {
      return true;
    }
  }

  return false;
}

if (isMainModule()) {
  const migrationResult = runMigration();
  process.exit(migrationResult.success ? 0 : 1);
}

export default runMigration;