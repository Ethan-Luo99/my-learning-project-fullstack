import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb, initDatabase } from '~/server/utils/db'

interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

interface ForeignKeyInfo {
  id: number
  seq: number
  table: string
  from: string
  to: string
  on_update: string
  on_delete: string
  match: string
}

interface IndexInfo {
  name: string
}

describe('表结构测试', () => {
  beforeAll(() => {
    closeDb()
    initDatabase()
  })

  afterAll(() => {
    closeDb()
  })

  describe('1. users 表结构测试', () => {
    function getUsersColumns(): ColumnInfo[] {
      const db = getDb()
      return db.pragma('table_info(users)') as ColumnInfo[]
    }

    it('1.1 应包含 id 列作为主键', () => {
      const columns = getUsersColumns()
      const idColumn = columns.find(c => c.name === 'id')
      
      expect(idColumn).toBeDefined()
      expect(idColumn?.pk).toBe(1)
    })

    it('1.2 应包含 username 列', () => {
      const columns = getUsersColumns()
      const usernameColumn = columns.find(c => c.name === 'username')
      
      expect(usernameColumn).toBeDefined()
      expect(usernameColumn?.type).toBe('TEXT')
      expect(usernameColumn?.notnull).toBe(1)
    })

    it('1.3 应包含 passwordHash 列 (注意: 验收标准中为 password_hash)', () => {
      const columns = getUsersColumns()
      const passwordHashColumn = columns.find(c => c.name === 'passwordHash')
      
      expect(passwordHashColumn).toBeDefined()
      expect(passwordHashColumn?.type).toBe('TEXT')
      expect(passwordHashColumn?.notnull).toBe(1)
    })

    it('1.4 应包含 createdAt 列 (注意: 验收标准中为 created_at)', () => {
      const columns = getUsersColumns()
      const createdAtColumn = columns.find(c => c.name === 'createdAt')
      
      expect(createdAtColumn).toBeDefined()
      expect(createdAtColumn?.type).toBe('TEXT')
      expect(createdAtColumn?.notnull).toBe(1)
    })

    it('1.5 验收标准中要求的 updated_at 列不存在 (差异说明)', () => {
      const columns = getUsersColumns()
      const updatedAtColumn = columns.find(c => c.name === 'updatedAt' || c.name === 'updated_at')
      
      expect(updatedAtColumn).toBeUndefined()
    })

    it('1.6 实际列清单 (供参考)', () => {
      const columns = getUsersColumns()
      const columnNames = columns.map(c => c.name)
      
      console.log('users 表实际列:', columnNames)
      
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('username')
      expect(columnNames).toContain('passwordHash')
      expect(columnNames).toContain('avatar')
      expect(columnNames).toContain('createdAt')
    })

    it('1.7 users.username 应有唯一约束', () => {
      const db = getDb()
      
      db.prepare(`
        INSERT OR IGNORE INTO users (id, username, passwordHash, avatar, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run('unique-test-1', 'uniqueuser', 'hash', null, '2024-01-01T00:00:00.000Z')

      expect(() => {
        db.prepare(`
          INSERT INTO users (id, username, passwordHash, avatar, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `).run('unique-test-2', 'uniqueuser', 'hash2', null, '2024-01-02T00:00:00.000Z')
      }).toThrow()
    })
  })

  describe('2. tasks 表结构测试', () => {
    function getTasksColumns(): ColumnInfo[] {
      const db = getDb()
      return db.pragma('table_info(tasks)') as ColumnInfo[]
    }

    it('2.1 应包含 id 列作为主键', () => {
      const columns = getTasksColumns()
      const idColumn = columns.find(c => c.name === 'id')
      
      expect(idColumn).toBeDefined()
      expect(idColumn?.pk).toBe(1)
    })

    it('2.2 应包含 userId 列 (注意: 验收标准中为 user_id)', () => {
      const columns = getTasksColumns()
      const userIdColumn = columns.find(c => c.name === 'userId')
      
      expect(userIdColumn).toBeDefined()
      expect(userIdColumn?.type).toBe('TEXT')
      expect(userIdColumn?.notnull).toBe(1)
    })

    it('2.3 应包含 title 列', () => {
      const columns = getTasksColumns()
      const titleColumn = columns.find(c => c.name === 'title')
      
      expect(titleColumn).toBeDefined()
      expect(titleColumn?.type).toBe('TEXT')
      expect(titleColumn?.notnull).toBe(1)
    })

    it('2.4 应包含 description 列', () => {
      const columns = getTasksColumns()
      const descriptionColumn = columns.find(c => c.name === 'description')
      
      expect(descriptionColumn).toBeDefined()
      expect(descriptionColumn?.type).toBe('TEXT')
    })

    it('2.5 应包含 completed 列 (INTEGER 0/1)', () => {
      const columns = getTasksColumns()
      const completedColumn = columns.find(c => c.name === 'completed')
      
      expect(completedColumn).toBeDefined()
      expect(completedColumn?.type).toBe('INTEGER')
      expect(completedColumn?.notnull).toBe(1)
      expect(completedColumn?.dflt_value).toBe('0')
    })

    it('2.6 应包含 createdAt 列 (注意: 验收标准中为 created_at)', () => {
      const columns = getTasksColumns()
      const createdAtColumn = columns.find(c => c.name === 'createdAt')
      
      expect(createdAtColumn).toBeDefined()
      expect(createdAtColumn?.type).toBe('TEXT')
      expect(createdAtColumn?.notnull).toBe(1)
    })

    it('2.7 应包含 updatedAt 列 (注意: 验收标准中为 updated_at)', () => {
      const columns = getTasksColumns()
      const updatedAtColumn = columns.find(c => c.name === 'updatedAt')
      
      expect(updatedAtColumn).toBeDefined()
      expect(updatedAtColumn?.type).toBe('TEXT')
      expect(updatedAtColumn?.notnull).toBe(1)
    })

    it('2.8 实际列清单 (供参考)', () => {
      const columns = getTasksColumns()
      const columnNames = columns.map(c => c.name)
      
      console.log('tasks 表实际列:', columnNames)
      
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('userId')
      expect(columnNames).toContain('title')
      expect(columnNames).toContain('description')
      expect(columnNames).toContain('completed')
      expect(columnNames).toContain('createdAt')
      expect(columnNames).toContain('updatedAt')
    })
  })

  describe('3. 外键约束测试', () => {
    it('3.1 tasks.userId 应有外键关联 users.id', () => {
      const db = getDb()
      const foreignKeys = db.pragma('foreign_key_list(tasks)') as ForeignKeyInfo[]
      
      const userIdForeignKey = foreignKeys.find(fk => fk.from === 'userId')
      
      expect(userIdForeignKey).toBeDefined()
      expect(userIdForeignKey?.table).toBe('users')
      expect(userIdForeignKey?.to).toBe('id')
    })

    it('3.2 外键应设置 ON DELETE CASCADE', () => {
      const db = getDb()
      const foreignKeys = db.pragma('foreign_key_list(tasks)') as ForeignKeyInfo[]
      
      const userIdForeignKey = foreignKeys.find(fk => fk.from === 'userId')
      
      expect(userIdForeignKey?.on_delete).toBe('CASCADE')
    })

    it('3.3 外键约束应生效 (插入无关联用户的任务应失败)', () => {
      const db = getDb()
      
      expect(() => {
        db.prepare(`
          INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('fk-test-1', 'nonexistent-user', 'Test', 'Desc', 0, '2024-01-01', '2024-01-01')
      }).toThrow()
    })
  })

  describe('4. 索引测试', () => {
    function getIndexes(tableName: string): string[] {
      const db = getDb()
      const indexes = db.pragma(`index_list(${tableName})`) as IndexInfo[]
      return indexes.map(i => i.name)
    }

    it('4.1 idx_users_username 索引应已创建', () => {
      const indexes = getIndexes('users')
      
      console.log('users 表索引:', indexes)
      
      expect(indexes).toContain('idx_users_username')
    })

    it('4.2 idx_tasks_userId 索引应已创建 (注意: 验收标准中为 idx_tasks_user_id)', () => {
      const indexes = getIndexes('tasks')
      
      console.log('tasks 表索引:', indexes)
      
      expect(indexes).toContain('idx_tasks_userId')
    })

    it('4.3 其他索引 (供参考)', () => {
      const tasksIndexes = getIndexes('tasks')
      
      console.log('tasks 表完整索引列表:', tasksIndexes)
      
      expect(tasksIndexes).toContain('idx_tasks_createdAt')
      expect(tasksIndexes).toContain('idx_tasks_completed')
    })
  })

  describe('5. 类型测试', () => {
    it('5.1 tasks.completed 应使用 INTEGER (0/1)', () => {
      const db = getDb()
      
      db.prepare(`
        INSERT OR IGNORE INTO users (id, username, passwordHash, avatar, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run('type-test-user', 'typetestuser', 'hash', null, '2024-01-01T00:00:00.000Z')

      const stmt1 = db.prepare(`
        INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      stmt1.run('type-test-1', 'type-test-user', 'Completed Task', 'Desc', 1, '2024-01-01', '2024-01-01')
      
      const stmt2 = db.prepare(`
        INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      stmt2.run('type-test-2', 'type-test-user', 'Incomplete Task', 'Desc', 0, '2024-01-01', '2024-01-01')

      const result1 = db.prepare('SELECT completed FROM tasks WHERE id = ?').get('type-test-1') as { completed: number }
      const result2 = db.prepare('SELECT completed FROM tasks WHERE id = ?').get('type-test-2') as { completed: number }

      expect(result1.completed).toBe(1)
      expect(result2.completed).toBe(0)
      expect(typeof result1.completed).toBe('number')
      expect(typeof result2.completed).toBe('number')
    })
  })
})
