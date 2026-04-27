import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { getDb, closeDb, tableExists, getTableCount, initDatabase, getDbPath } from '~/server/utils/db'
import { initializeDatabase } from '~/server/utils/db-init'

describe('数据库功能测试', () => {
  beforeAll(() => {
    closeDb()
  })

  afterAll(() => {
    closeDb()
  })

  describe('1. getDb() 单例模式测试', () => {
    it('1.1 应返回数据库连接实例', () => {
      const db = getDb()
      expect(db).toBeDefined()
      expect(db).toBeInstanceOf(Database)
    })

    it('1.2 多次调用应返回同一实例 (单例)', () => {
      const db1 = getDb()
      const db2 = getDb()
      const db3 = getDb()
      
      expect(db1).toBe(db2)
      expect(db2).toBe(db3)
    })
  })

  describe('2. closeDb() 关闭连接测试', () => {
    it('2.1 应正确关闭数据库连接', () => {
      const db1 = getDb()
      expect(db1.open).toBe(true)
      
      closeDb()
      
      expect(db1.open).toBe(false)
    })

    it('2.2 关闭后重新获取应创建新实例', () => {
      closeDb()
      
      const db1 = getDb()
      const db1Ref = db1
      
      closeDb()
      
      const db2 = getDb()
      
      expect(db1Ref).not.toBe(db2)
    })
  })

  describe('3. initDatabase() 初始化测试', () => {
    beforeAll(() => {
      closeDb()
    })

    it('3.1 应创建 users 表', () => {
      initDatabase()
      expect(tableExists('users')).toBe(true)
    })

    it('3.2 应创建 tasks 表', () => {
      initDatabase()
      expect(tableExists('tasks')).toBe(true)
    })

    it('3.3 重复调用不应报错 (IF NOT EXISTS)', () => {
      expect(() => {
        initDatabase()
        initDatabase()
        initDatabase()
      }).not.toThrow()
    })
  })

  describe('4. initializeDatabase() 包装函数测试', () => {
    beforeAll(() => {
      closeDb()
    })

    it('4.1 应成功初始化数据库', () => {
      expect(() => {
        initializeDatabase()
      }).not.toThrow()
      
      expect(tableExists('users')).toBe(true)
      expect(tableExists('tasks')).toBe(true)
    })
  })

  describe('5. 数据库配置测试 (WAL 和 外键)', () => {
    it('5.1 WAL 模式应已启用', () => {
      const db = getDb()
      const result = db.pragma('journal_mode', { simple: true })
      expect(result).toBe('wal')
    })

    it('5.2 外键约束应已启用', () => {
      const db = getDb()
      const result = db.pragma('foreign_keys', { simple: true })
      expect(result).toBe(1)
    })
  })

  describe('6. tableExists() 测试', () => {
    beforeAll(() => {
      initDatabase()
    })

    it('6.1 应正确检测存在的表', () => {
      expect(tableExists('users')).toBe(true)
      expect(tableExists('tasks')).toBe(true)
    })

    it('6.2 应正确检测不存在的表', () => {
      expect(tableExists('nonexistent_table')).toBe(false)
      expect(tableExists('random_table_123')).toBe(false)
    })

    it('6.3 对大小写敏感 (SQLite 默认行为)', () => {
      expect(tableExists('USERS')).toBe(false)
      expect(tableExists('Tasks')).toBe(false)
    })
  })

  describe('7. getTableCount() 测试', () => {
    beforeAll(() => {
      initDatabase()
      const db = getDb()
      db.exec('DELETE FROM tasks')
      db.exec('DELETE FROM users')
    })

    it('7.1 空表应返回 0', () => {
      expect(getTableCount('users')).toBe(0)
      expect(getTableCount('tasks')).toBe(0)
    })

    it('7.2 不存在的表应返回 0', () => {
      expect(getTableCount('nonexistent_table')).toBe(0)
    })

    it('7.3 插入数据后应返回正确计数', () => {
      const db = getDb()
      
      db.prepare(`
        INSERT INTO users (id, username, passwordHash, avatar, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run('test-id-1', 'testuser1', 'hash1', null, '2024-01-01T00:00:00.000Z')

      db.prepare(`
        INSERT INTO users (id, username, passwordHash, avatar, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run('test-id-2', 'testuser2', 'hash2', null, '2024-01-02T00:00:00.000Z')

      expect(getTableCount('users')).toBe(2)

      db.prepare(`
        INSERT INTO tasks (id, userId, title, description, completed, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('task-1', 'test-id-1', 'Task 1', 'Desc 1', 0, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')

      expect(getTableCount('tasks')).toBe(1)
    })
  })

  describe('8. 数据库路径测试', () => {
    it('8.1 getDbPath() 应返回正确路径', () => {
      const path = getDbPath()
      expect(path).toBeDefined()
      expect(typeof path).toBe('string')
      expect(path.endsWith('app.db')).toBe(true)
    })
  })
})
