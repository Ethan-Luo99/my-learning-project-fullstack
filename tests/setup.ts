import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let testDb: Database.Database | null = null

export function getTestDb(): Database.Database {
  if (!testDb) {
    throw new Error('Test database not initialized')
  }
  return testDb
}

function initTestDatabase(): void {
  testDb = new Database(':memory:')
  
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      avatar TEXT NULL,
      createdAt TEXT NOT NULL
    )
  `)
  
  testDb.exec(`
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
  `)
  
  testDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_tasks_userId ON tasks(userId);
    CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
  `)
}

function closeTestDatabase(): void {
  if (testDb) {
    testDb.close()
    testDb = null
  }
}

vi.mock('~/server/utils/db', () => {
  return {
    getDb: () => {
      if (!testDb) {
        initTestDatabase()
      }
      return testDb
    },
    closeDb: () => {
      closeTestDatabase()
    },
    initDatabase: () => {
      initTestDatabase()
    },
    tableExists: (tableName: string) => {
      if (!testDb) return false
      const result = testDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(tableName)
      return result !== undefined
    },
    getDbPath: () => ':memory:'
  }
})

const mockStateStore = new Map<string, any>()

vi.mock('nuxt/app', () => ({
  useState: <T>(key: string, init?: () => T): { value: T } => {
    if (!mockStateStore.has(key) && init) {
      mockStateStore.set(key, init())
    }
    return {
      get value() {
        return mockStateStore.get(key)
      },
      set value(newValue: T) {
        mockStateStore.set(key, newValue)
      }
    }
  },
  useFetch: vi.fn(),
  useNuxtApp: vi.fn(() => ({
    $fetch: vi.fn()
  }))
}))

const mockFetch = vi.fn()

vi.mock('ofetch', () => ({
  $fetch: mockFetch,
  ofetch: mockFetch
}))

Object.defineProperty(global, '$fetch', {
  value: mockFetch,
  writable: true
})

Object.defineProperty(global, 'computed', {
  value: <T>(fn: () => T) => ({
    get value() {
      return fn()
    }
  }),
  writable: true
})

const mockLocalStorage: Record<string, string> = {}

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockLocalStorage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage[key]
    }),
    clear: vi.fn(() => {
      Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
    })
  },
  writable: true
})

beforeAll(() => {
  initTestDatabase()
})

afterAll(() => {
  closeTestDatabase()
})

beforeEach(() => {
  vi.clearAllMocks()
  mockStateStore.clear()
  Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
  
  if (testDb) {
    testDb.exec('DELETE FROM tasks')
    testDb.exec('DELETE FROM users')
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

export { mockFetch, mockLocalStorage, mockStateStore }
