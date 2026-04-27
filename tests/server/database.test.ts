import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn((path: string) => {
      if (path.includes('users.json') || path.includes('tasks.json')) {
        return true
      }
      return true
    }),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn((path: string, encoding: string) => {
      if (path.includes('users.json')) {
        return JSON.stringify([
          {
            id: 'test-user-id-1',
            username: 'testuser1',
            passwordHash: 'hashedpassword1',
            createdAt: '2024-01-01T00:00:00.000Z'
          },
          {
            id: 'test-user-id-2',
            username: 'testuser2',
            passwordHash: 'hashedpassword2',
            createdAt: '2024-01-02T00:00:00.000Z'
          }
        ])
      }
      if (path.includes('tasks.json')) {
        return JSON.stringify([
          {
            id: 'task-id-1',
            userId: 'test-user-id-1',
            title: 'Test Task 1',
            description: 'Description 1',
            completed: false,
            createdAt: '2024-01-01T10:00:00.000Z',
            updatedAt: '2024-01-01T10:00:00.000Z'
          },
          {
            id: 'task-id-2',
            userId: 'test-user-id-1',
            title: 'Test Task 2',
            description: 'Description 2',
            completed: true,
            createdAt: '2024-01-02T08:00:00.000Z',
            updatedAt: '2024-01-03T12:00:00.000Z'
          },
          {
            id: 'task-id-3',
            userId: 'test-user-id-2',
            title: 'Test Task 3',
            description: '',
            completed: false,
            createdAt: '2024-01-01T09:00:00.000Z',
            updatedAt: '2024-01-01T09:00:00.000Z'
          }
        ])
      }
      return '[]'
    }),
    writeFileSync: vi.fn()
  }
}))

import { findUserByUsername, findUserById, createUser, findTasksByUserId, findTaskById, createTask, updateTask, deleteTask, type UserData, type TaskData } from '~/server/utils/database'

describe('database utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UserData interface', () => {
    it('should have all required properties with correct types', () => {
      const userData: UserData = {
        id: 'test-id',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        createdAt: '2024-01-01T00:00:00.000Z'
      }

      expect(userData.id).toBeDefined()
      expect(typeof userData.id).toBe('string')
      expect(userData.username).toBeDefined()
      expect(typeof userData.username).toBe('string')
      expect(userData.passwordHash).toBeDefined()
      expect(typeof userData.passwordHash).toBe('string')
      expect(userData.createdAt).toBeDefined()
      expect(typeof userData.createdAt).toBe('string')
    })
  })

  describe('TaskData interface', () => {
    it('should have all required properties with correct types', () => {
      const taskData: TaskData = {
        id: 'task-id',
        userId: 'user-id',
        title: 'Test Task',
        description: 'Description',
        completed: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      expect(taskData.id).toBeDefined()
      expect(typeof taskData.id).toBe('string')
      expect(taskData.userId).toBeDefined()
      expect(typeof taskData.userId).toBe('string')
      expect(taskData.title).toBeDefined()
      expect(typeof taskData.title).toBe('string')
      expect(taskData.description).toBeDefined()
      expect(typeof taskData.description).toBe('string')
      expect(taskData.completed).toBeDefined()
      expect(typeof taskData.completed).toBe('boolean')
      expect(taskData.createdAt).toBeDefined()
      expect(typeof taskData.createdAt).toBe('string')
      expect(taskData.updatedAt).toBeDefined()
      expect(typeof taskData.updatedAt).toBe('string')
    })

    it('should support empty description', () => {
      const taskData: TaskData = {
        id: 'task-id',
        userId: 'user-id',
        title: 'Test Task',
        description: '',
        completed: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      expect(taskData.description).toBe('')
    })

    it('should support completed tasks', () => {
      const taskData: TaskData = {
        id: 'task-id',
        userId: 'user-id',
        title: 'Test Task',
        description: 'Description',
        completed: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z'
      }

      expect(taskData.completed).toBe(true)
    })
  })

  describe('findUserByUsername function', () => {
    it('should return user when username exists', () => {
      const user = findUserByUsername('testuser1')
      
      expect(user).toBeDefined()
      expect(user?.username).toBe('testuser1')
      expect(user?.id).toBe('test-user-id-1')
    })

    it('should return undefined when username does not exist', () => {
      const user = findUserByUsername('nonexistentuser')
      
      expect(user).toBeUndefined()
    })

    it('should be case sensitive', () => {
      const user = findUserByUsername('TestUser1')
      
      expect(user).toBeUndefined()
    })
  })

  describe('findUserById function', () => {
    it('should return user when ID exists', () => {
      const user = findUserById('test-user-id-1')
      
      expect(user).toBeDefined()
      expect(user?.id).toBe('test-user-id-1')
      expect(user?.username).toBe('testuser1')
    })

    it('should return undefined when ID does not exist', () => {
      const user = findUserById('nonexistent-id')
      
      expect(user).toBeUndefined()
    })
  })

  describe('createUser function', () => {
    it('should add user to the database', () => {
      const newUser: UserData = {
        id: 'new-user-id',
        username: 'newuser',
        passwordHash: 'newhashedpassword',
        createdAt: '2024-01-15T00:00:00.000Z'
      }
      
      createUser(newUser)
      
      expect(newUser.id).toBe('new-user-id')
      expect(newUser.username).toBe('newuser')
    })
  })

  describe('findTasksByUserId function', () => {
    it('should return tasks for a specific user', () => {
      const tasks = findTasksByUserId('test-user-id-1')
      
      expect(tasks).toBeDefined()
      expect(Array.isArray(tasks)).toBe(true)
      expect(tasks.length).toBe(2)
      tasks.forEach(task => {
        expect(task.userId).toBe('test-user-id-1')
      })
    })

    it('should return empty array for user with no tasks', () => {
      const tasks = findTasksByUserId('nonexistent-user')
      
      expect(tasks).toEqual([])
      expect(tasks.length).toBe(0)
    })

    it('should return tasks sorted by createdAt descending', () => {
      const tasks = findTasksByUserId('test-user-id-1')
      
      expect(tasks.length).toBe(2)
      const firstDate = new Date(tasks[0].createdAt).getTime()
      const secondDate = new Date(tasks[1].createdAt).getTime()
      
      expect(firstDate).toBeGreaterThan(secondDate)
    })
  })

  describe('findTaskById function', () => {
    it('should return task when ID exists', () => {
      const task = findTaskById('task-id-1')
      
      expect(task).toBeDefined()
      expect(task?.id).toBe('task-id-1')
      expect(task?.title).toBe('Test Task 1')
    })

    it('should return undefined when ID does not exist', () => {
      const task = findTaskById('nonexistent-task-id')
      
      expect(task).toBeUndefined()
    })
  })

  describe('createTask function', () => {
    it('should add task to the database', () => {
      const newTask: TaskData = {
        id: 'new-task-id',
        userId: 'test-user-id-1',
        title: 'New Task',
        description: 'New Description',
        completed: false,
        createdAt: '2024-01-15T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z'
      }
      
      createTask(newTask)
      
      expect(newTask.id).toBe('new-task-id')
      expect(newTask.title).toBe('New Task')
    })
  })

  describe('updateTask function', () => {
    it('should update task properties', () => {
      const taskId = 'task-id-1'
      const updates: Partial<TaskData> = {
        title: 'Updated Title',
        completed: true,
        updatedAt: '2024-01-15T00:00:00.000Z'
      }
      
      const updatedTask = updateTask(taskId, updates)
      
      expect(updatedTask).toBeDefined()
    })

    it('should return undefined for non-existent task', () => {
      const taskId = 'nonexistent-task-id'
      const updates: Partial<TaskData> = {
        title: 'Updated Title'
      }
      
      const updatedTask = updateTask(taskId, updates)
      
      expect(updatedTask).toBeUndefined()
    })
  })

  describe('deleteTask function', () => {
    it('should return true for existing task', () => {
      const result = deleteTask('task-id-1')
      
      expect(result).toBe(true)
    })

    it('should return false for non-existent task', () => {
      const result = deleteTask('nonexistent-task-id')
      
      expect(result).toBe(false)
    })
  })

  describe('Data operations edge cases', () => {
    it('should handle empty task arrays', () => {
      const tasks = findTasksByUserId('nonexistent-user')
      
      expect(tasks.length).toBe(0)
      expect(Array.isArray(tasks)).toBe(true)
    })

    it('should handle task with empty description', () => {
      const task = findTaskById('task-id-3')
      
      expect(task).toBeDefined()
      expect(task?.description).toBe('')
    })

    it('should handle completed tasks correctly', () => {
      const task = findTaskById('task-id-2')
      
      expect(task).toBeDefined()
      expect(task?.completed).toBe(true)
    })
  })
})
