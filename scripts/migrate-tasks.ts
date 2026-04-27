import { initDatabase, getDb, getTableCount, getDbPath } from '../server/utils/db';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

interface TaskData {
  id: string;
  userId: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TaskOperation {
  action: 'insert' | 'skip' | 'invalid_user';
  task: TaskData;
  reason?: string;
}

interface ValidationResult {
  validTasks: TaskData[];
  invalidTasks: { task: TaskData; reason: string }[];
  existingUserIds: Set<string>;
}

interface MigrationResult {
  success: boolean;
  backupPath?: string;
  tasks: {
    read: number;
    valid: number;
    invalidUserId: number;
    inserted: number;
    skipped: number;
    errors: string[];
  };
  totalTime: number;
  error?: string;
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

function getAllUserIds(db: ReturnType<typeof getDb>): Set<string> {
  const rows = db.prepare('SELECT id FROM users').all() as Array<{ id: string }>;
  return new Set(rows.map(row => row.id));
}

function validateTasksAgainstForeignKeys(
  tasks: TaskData[],
  existingUserIds: Set<string>
): ValidationResult {
  const validTasks: TaskData[] = [];
  const invalidTasks: { task: TaskData; reason: string }[] = [];

  for (const task of tasks) {
    if (!existingUserIds.has(task.userId)) {
      invalidTasks.push({
        task,
        reason: `userId "${task.userId}" 在 users 表中不存在`
      });
    } else {
      validTasks.push(task);
    }
  }

  return { validTasks, invalidTasks, existingUserIds };
}

function insertTask(db: ReturnType<typeof getDb>, task: TaskData): void {
  const completedInt = task.completed ? 1 : 0;

  db.prepare(`
    INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(task.id, task.userId, task.title, task.description, completedInt, task.createdAt, task.updatedAt);
}

function taskExists(db: ReturnType<typeof getDb>, id: string): boolean {
  const result = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  return result !== undefined;
}

export function runMigration(): MigrationResult {
  const startTime = Date.now();

  const result: MigrationResult = {
    success: false,
    tasks: { 
      read: 0, 
      valid: 0, 
      invalidUserId: 0, 
      inserted: 0, 
      skipped: 0, 
      errors: [] 
    },
    totalTime: 0
  };

  const operations: TaskOperation[] = [];

  try {
    console.log('========================================');
    console.log('   任务数据迁移: JSON → SQLite');
    console.log('========================================');

    console.log('\n[1/6] 创建数据备份...');
    const backupPath = createBackup(TASKS_FILE, '任务');
    result.backupPath = backupPath;
    if (backupPath) {
      console.log('      ✓ 备份创建成功');
    } else {
      console.log('      ⚠️ 未创建备份（源文件可能不存在）');
    }

    console.log('\n[2/6] 初始化数据库...');
    initDatabase();
    console.log('      ✓ 数据库初始化完成');
    console.log(`      数据库路径: ${getDbPath()}`);

    const db = getDb();

    const tasksBefore = getTableCount('tasks');

    console.log(`\n[3/6] 读取 JSON 数据文件...`);
    console.log(`      数据源: ${DATA_DIR}`);

    const rawTasks = readJsonFile<Record<string, unknown>>(TASKS_FILE);
    const tasks = rawTasks.map(normalizeTaskData);

    result.tasks.read = tasks.length;

    console.log(`      ✓ 读取到 ${tasks.length} 个任务`);

    console.log('\n[4/6] 验证外键约束 (userId)...');

    const existingUserIds = getAllUserIds(db);
    console.log(`      数据库中现有用户数: ${existingUserIds.size}`);

    const validation = validateTasksAgainstForeignKeys(tasks, existingUserIds);
    result.tasks.valid = validation.validTasks.length;
    result.tasks.invalidUserId = validation.invalidTasks.length;

    if (validation.invalidTasks.length > 0) {
      console.log(`      ⚠️ 发现 ${validation.invalidTasks.length} 个任务的 userId 无效`);
      console.log('\n      无效任务列表:');
      for (const invalid of validation.invalidTasks) {
        console.log(`        - 任务 "${invalid.task.title}" (ID: ${invalid.task.id}): ${invalid.reason}`);
      }

      console.log('\n      ⚠️ 重要提示:');
      console.log('         这些任务将被跳过，因为它们的 userId 在 users 表中不存在。');
      console.log('         建议先迁移用户数据，或者手动修复这些任务的 userId。');
    } else {
      console.log('      ✓ 所有任务的 userId 验证通过');
    }

    console.log('\n[5/6] 开始数据迁移 (事务保护)...');
    console.log(`      迁移前 tasks 表: ${tasksBefore} 条`);
    console.log(`      待迁移有效任务: ${validation.validTasks.length} 条`);

    const migrate = db.transaction(() => {
      for (const task of validation.validTasks) {
        try {
          if (taskExists(db, task.id)) {
            result.tasks.skipped++;
            operations.push({ action: 'skip', task });
          } else {
            insertTask(db, task);
            result.tasks.inserted++;
            operations.push({ action: 'insert', task });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.tasks.errors.push(`任务 ${task.id}: ${errorMsg}`);
          throw error;
        }
      }
    });

    migrate();
    console.log('\n      ✓ 事务提交成功');

    console.log('\n      迁移操作详情:');
    for (const op of operations) {
      if (op.action === 'insert') {
        console.log(`        [插入] 任务: ${op.task.title}`);
      } else if (op.action === 'skip') {
        console.log(`        [跳过] 任务已存在: ${op.task.id} (${op.task.title})`);
      }
    }

    if (validation.invalidTasks.length > 0) {
      console.log('\n      [跳过] 无效 userId 的任务:');
      for (const invalid of validation.invalidTasks) {
        operations.push({ 
          action: 'invalid_user', 
          task: invalid.task, 
          reason: invalid.reason 
        });
        console.log(`        [跳过] 无效 userId: ${invalid.task.title} (userId: ${invalid.task.userId})`);
      }
    }

    console.log('\n[6/6] 验证迁移结果...');

    const tasksAfter = getTableCount('tasks');

    const tasksExpected = tasksBefore + result.tasks.inserted;

    const tasksMatch = tasksAfter === tasksExpected;

    if (tasksMatch) {
      console.log(`      ✓ tasks 表计数验证通过: ${tasksAfter} 条`);
    } else {
      console.log(`      ✗ tasks 表计数不匹配: 期望 ${tasksExpected}, 实际 ${tasksAfter}`);
    }

    result.totalTime = Date.now() - startTime;
    result.success = tasksMatch && result.tasks.errors.length === 0;

    console.log('\n========================================');
    console.log('   迁移结果汇总');
    console.log('========================================');

    if (result.backupPath) {
      console.log(`\n💾 数据备份: ${result.backupPath}`);
    }

    console.log('\n📋 任务数据:');
    console.log(`   读取: ${result.tasks.read} 条`);
    console.log(`   ✓ 有效: ${result.tasks.valid} 条`);
    console.log(`   ✗ 无效 userId: ${result.tasks.invalidUserId} 条`);
    console.log(`   插入: ${result.tasks.inserted} 条`);
    console.log(`   跳过: ${result.tasks.skipped} 条`);
    console.log(`   错误: ${result.tasks.errors.length} 条`);
    console.log(`   迁移前: ${tasksBefore} 条`);
    console.log(`   迁移后: ${tasksAfter} 条`);

    console.log(`\n⏱️ 总耗时: ${result.totalTime}ms`);

    if (result.tasks.errors.length > 0) {
      console.log('\n⚠️ 迁移过程中遇到错误:');
      result.tasks.errors.forEach(err => console.log(`   任务错误: ${err}`));
    }

    if (result.tasks.invalidUserId > 0) {
      console.log('\n⚠️ 部分任务因无效 userId 被跳过:');
      console.log('   建议:');
      console.log('   1. 先运行用户数据迁移 (migrate-users.ts)');
      console.log('   2. 或者手动修复 tasks.json 中的无效 userId');
      console.log('   3. 无效任务的详细列表已在上方显示');
    }

    if (result.success) {
      if (result.tasks.invalidUserId > 0) {
        console.log('\n⚠️ 迁移部分完成 (部分任务因无效 userId 被跳过)');
      } else {
        console.log('\n✅ 迁移成功!');
      }
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
          console.log(`   [未执行] 插入任务: ${op.task.title}`);
        }
      }
    }

    if (result.backupPath) {
      console.log(`\n💾 数据备份保留在: ${result.backupPath}`);
    }

    return result;
  }
}

if (isMainModule()) {
  const migrationResult = runMigration();
  process.exit(migrationResult.success ? 0 : 1);
}

export default runMigration;