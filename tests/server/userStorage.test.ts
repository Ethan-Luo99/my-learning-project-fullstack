import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (password: string, saltRounds: number) => {
      return `hashed-${password}`
    }),
    compare: vi.fn(async (password: string, hash: string) => {
      return hash === `hashed-${password}`
    })
  }
}))

vi.mock('~/server/utils/database', () => ({
  findUserByUsername: vi.fn((username: string) => {
    if (username === 'existinguser') {
      return {
        id: 'existing-id',
        username: 'existinguser',
        passwordHash: 'hashed-existingpassword',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    }
    return undefined
  }),
  findUserById: vi.fn((id: string) => {
    if (id === 'test-user-id') {
      return {
        id: 'test-user-id',
        username: 'testuser',
        passwordHash: 'hashed-testpassword',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    }
    return undefined
  }),
  createUser: vi.fn()
}))

import { generateId, getCurrentTimestamp, hashPassword, comparePassword, findUserByUsername, findUserById, createUser, type User } from '~/server/utils/userStorage'

describe('userStorage utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateId function', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      
      expect(id1).toBeDefined()
      expect(typeof id1).toBe('string')
      expect(id1.length).toBeGreaterThan(0)
      expect(id1).not.toBe(id2)
    })

    it('should generate non-empty IDs', () => {
      for (let i = 0; i < 10; i++) {
        const id = generateId()
        expect(id).not.toBe('')
        expect(id.length).toBeGreaterThan(5)
      }
    })

    it('should generate IDs using base36 encoding', () => {
      const id = generateId()
      expect(id).toMatch(/^[a-z0-9]+$/)
    })
  })

  describe('getCurrentTimestamp function', () => {
    it('should return a valid ISO timestamp', () => {
      const timestamp = getCurrentTimestamp()
      
      expect(timestamp).toBeDefined()
      expect(typeof timestamp).toBe('string')
      
      const parsedDate = new Date(timestamp)
      expect(parsedDate.toISOString()).toBe(timestamp)
    })

    it('should return timestamp with correct format', () => {
      const timestamp = getCurrentTimestamp()
      
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })
  })

  describe('hashPassword function', () => {
    it('should hash password correctly', async () => {
      const password = 'testpassword123'
      
      const hash = await hashPassword(password)
      
      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      expect(hash).toContain(password)
    })

    it('should produce different hashes for different passwords', async () => {
      const hash1 = await hashPassword('password1')
      const hash2 = await hashPassword('password2')
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('comparePassword function', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'testpassword'
      const hash = `hashed-${password}`
      
      const result = await comparePassword(password, hash)
      
      expect(result).toBe(true)
    })

    it('should return false for non-matching password and hash', async () => {
      const password = 'wrongpassword'
      const hash = 'hashed-correctpassword'
      
      const result = await comparePassword(password, hash)
      
      expect(result).toBe(false)
    })
  })

  describe('findUserByUsername function', () => {
    it('should return user when username exists', () => {
      const user = findUserByUsername('existinguser')
      
      expect(user).toBeDefined()
      expect(user?.username).toBe('existinguser')
      expect(user?.id).toBe('existing-id')
    })

    it('should return undefined when username does not exist', () => {
      const user = findUserByUsername('nonexistentuser')
      
      expect(user).toBeUndefined()
    })
  })

  describe('findUserById function', () => {
    it('should return user when ID exists', () => {
      const user = findUserById('test-user-id')
      
      expect(user).toBeDefined()
      expect(user?.id).toBe('test-user-id')
      expect(user?.username).toBe('testuser')
    })

    it('should return undefined when ID does not exist', () => {
      const user = findUserById('nonexistent-id')
      
      expect(user).toBeUndefined()
    })
  })

  describe('createUser function', () => {
    it('should create a user with correct structure', async () => {
      const username = 'newuser'
      const password = 'newpassword123'
      
      const user = await createUser(username, password)
      
      expect(user).toBeDefined()
      expect(user.id).toBeDefined()
      expect(typeof user.id).toBe('string')
      expect(user.username).toBe(username)
      expect(user.passwordHash).toBeDefined()
      expect(user.createdAt).toBeDefined()
      expect(typeof user.createdAt).toBe('string')
    })

    it('should generate unique IDs for different users', async () => {
      const user1 = await createUser('user1', 'password1')
      const user2 = await createUser('user2', 'password2')
      
      expect(user1.id).not.toBe(user2.id)
    })

    it('should set createdAt to current time', async () => {
      const beforeCreate = new Date()
      const user = await createUser('testuser', 'testpassword')
      const afterCreate = new Date()
      
      const createdAt = new Date(user.createdAt)
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
    })
  })

  describe('User interface', () => {
    it('should have all required properties with correct types', () => {
      const mockUser: User = {
        id: 'test-id',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        createdAt: '2024-01-01T00:00:00.000Z'
      }

      expect(mockUser.id).toBeDefined()
      expect(typeof mockUser.id).toBe('string')
      
      expect(mockUser.username).toBeDefined()
      expect(typeof mockUser.username).toBe('string')
      
      expect(mockUser.passwordHash).toBeDefined()
      expect(typeof mockUser.passwordHash).toBe('string')
      
      expect(mockUser.createdAt).toBeDefined()
      expect(typeof mockUser.createdAt).toBe('string')
    })
  })
})
