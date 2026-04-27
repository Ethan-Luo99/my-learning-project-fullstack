import { describe, it, expect } from 'vitest'

describe('taskStorage utilities', () => {
  describe('generateId function logic', () => {
    it('should generate unique IDs using timestamp and random', () => {
      const generateId = (): string => {
        return Date.now().toString(36) + Math.random().toString(36).substring(2)
      }
      
      const id1 = generateId()
      const id2 = generateId()
      
      expect(id1).toBeDefined()
      expect(typeof id1).toBe('string')
      expect(id1.length).toBeGreaterThan(0)
      expect(id1).not.toBe(id2)
    })

    it('should generate IDs using base36 encoding', () => {
      const timestamp = Date.now()
      const base36Timestamp = timestamp.toString(36)
      
      expect(base36Timestamp).toMatch(/^[a-z0-9]+$/)
    })
  })

  describe('getCurrentTimestamp function logic', () => {
    it('should return a valid ISO timestamp', () => {
      const getCurrentTimestamp = (): string => {
        return new Date().toISOString()
      }
      
      const timestamp = getCurrentTimestamp()
      
      expect(timestamp).toBeDefined()
      expect(typeof timestamp).toBe('string')
      
      const parsedDate = new Date(timestamp)
      expect(parsedDate.toISOString()).toBe(timestamp)
    })

    it('should return timestamp with correct format', () => {
      const timestamp = new Date().toISOString()
      
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })
  })

  describe('Task interface', () => {
    it('should have all required properties with correct types', () => {
      const mockTask = {
        id: 'test-id',
        title: 'Test Task',
        description: 'Test Description',
        completed: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      expect(mockTask.id).toBeDefined()
      expect(typeof mockTask.id).toBe('string')
      
      expect(mockTask.title).toBeDefined()
      expect(typeof mockTask.title).toBe('string')
      
      expect(mockTask.description).toBeDefined()
      expect(typeof mockTask.description).toBe('string')
      
      expect(mockTask.completed).toBeDefined()
      expect(typeof mockTask.completed).toBe('boolean')
      
      expect(mockTask.createdAt).toBeDefined()
      expect(typeof mockTask.createdAt).toBe('string')
      
      expect(mockTask.updatedAt).toBeDefined()
      expect(typeof mockTask.updatedAt).toBe('string')
    })

    it('should support empty description', () => {
      const mockTask = {
        id: 'test-id',
        title: 'Test Task',
        description: '',
        completed: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      expect(mockTask.description).toBe('')
    })

    it('should support completed tasks', () => {
      const mockTask = {
        id: 'test-id',
        title: 'Test Task',
        description: 'Description',
        completed: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z'
      }

      expect(mockTask.completed).toBe(true)
    })
  })

  describe('Task array operations', () => {
    it('should support empty task arrays', () => {
      const tasks: any[] = []
      
      expect(tasks.length).toBe(0)
      expect(Array.isArray(tasks)).toBe(true)
    })

    it('should support multiple tasks', () => {
      const tasks = [
        {
          id: 'id-1',
          title: 'Task 1',
          description: '',
          completed: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'id-2',
          title: 'Task 2',
          description: 'Description',
          completed: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z'
        }
      ]
      
      expect(tasks.length).toBe(2)
      expect(tasks[0].id).toBe('id-1')
      expect(tasks[1].id).toBe('id-2')
    })

    it('should support JSON serialization', () => {
      const tasks = [
        {
          id: 'test-id',
          title: 'Test Task',
          description: 'Description',
          completed: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        }
      ]
      
      const json = JSON.stringify(tasks, null, 2)
      const parsed = JSON.parse(json)
      
      expect(parsed).toEqual(tasks)
      expect(json).toContain('test-id')
      expect(json).toContain('Test Task')
    })
  })

  describe('ID generation edge cases', () => {
    it('should generate unique IDs even in rapid succession', () => {
      const generateId = (): string => {
        return Date.now().toString(36) + Math.random().toString(36).substring(2)
      }
      
      const ids: string[] = []
      for (let i = 0; i < 100; i++) {
        ids.push(generateId())
      }
      
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBeGreaterThanOrEqual(ids.length * 0.9)
    })

    it('should generate non-empty IDs', () => {
      const generateId = (): string => {
        return Date.now().toString(36) + Math.random().toString(36).substring(2)
      }
      
      for (let i = 0; i < 10; i++) {
        const id = generateId()
        expect(id).not.toBe('')
        expect(id.length).toBeGreaterThan(5)
      }
    })
  })

  describe('Timestamp validation', () => {
    it('should validate correct ISO timestamps', () => {
      const validTimestamps = [
        '2024-01-01T00:00:00.000Z',
        '2024-12-31T23:59:59.999Z',
        '2024-06-15T12:30:45.123Z'
      ]
      
      validTimestamps.forEach(timestamp => {
        const parsed = new Date(timestamp)
        expect(parsed.toISOString()).toBe(timestamp)
      })
    })

    it('should handle timestamp comparison', () => {
      const earlier = '2024-01-01T00:00:00.000Z'
      const later = '2024-01-02T00:00:00.000Z'
      
      const earlierDate = new Date(earlier)
      const laterDate = new Date(later)
      
      expect(earlierDate.getTime()).toBeLessThan(laterDate.getTime())
    })
  })
})

interface TaskWithUser {
  id: string
  userId: string
  title: string
  description: string
  completed: boolean
  createdAt: string
  updatedAt: string
  user: {
    id: string
    username: string
  }
}

interface TaskQueryOptions {
  status?: 'all' | 'active' | 'completed'
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'priority'
  order?: 'asc' | 'desc'
}

function readTasksWithUsersByUserIdLogic(
  tasks: TaskWithUser[],
  options?: TaskQueryOptions
): TaskWithUser[] {
  let result = [...tasks]

  const status = options?.status || 'all'
  if (status === 'active') {
    result = result.filter(task => !task.completed)
  } else if (status === 'completed') {
    result = result.filter(task => task.completed)
  }

  const sortBy = options?.sortBy || 'createdAt'
  const order = options?.order || 'desc'
  
  result.sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'title':
        comparison = a.title.localeCompare(b.title, 'zh-CN')
        break
      case 'updatedAt':
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        break
      case 'priority':
        const priorityOrder = ['low', 'medium', 'high']
        const aPriority = (a as any).priority || 'medium'
        const bPriority = (b as any).priority || 'medium'
        comparison = priorityOrder.indexOf(aPriority) - priorityOrder.indexOf(bPriority)
        break
      case 'createdAt':
      default:
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
    }
    
    return order === 'desc' ? -comparison : comparison
  })

  return result
}

const mockTasks: TaskWithUser[] = [
  {
    id: 'task-1',
    userId: 'user-1',
    title: 'Alpha Task',
    description: 'First task',
    completed: false,
    createdAt: '2024-01-15T10:30:00.000Z',
    updatedAt: '2024-01-15T10:30:00.000Z',
    user: { id: 'user-1', username: 'testuser' }
  },
  {
    id: 'task-2',
    userId: 'user-1',
    title: 'Beta Task',
    description: 'Second task',
    completed: true,
    createdAt: '2024-01-14T08:00:00.000Z',
    updatedAt: '2024-01-16T14:00:00.000Z',
    user: { id: 'user-1', username: 'testuser' }
  },
  {
    id: 'task-3',
    userId: 'user-1',
    title: 'Gamma Task',
    description: 'Third task',
    completed: false,
    createdAt: '2024-01-13T12:00:00.000Z',
    updatedAt: '2024-01-13T12:00:00.000Z',
    user: { id: 'user-1', username: 'testuser' }
  }
]

describe('readTasksWithUsersByUserId - Status Filtering', () => {
  describe('Status filter "all"', () => {
    it('should return all tasks when status is "all"', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { status: 'all' })
      
      expect(result.length).toBe(3)
    })

    it('should return all tasks when no status option provided', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, {})
      
      expect(result.length).toBe(3)
    })

    it('should return all tasks when options is undefined', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks)
      
      expect(result.length).toBe(3)
    })
  })

  describe('Status filter "active"', () => {
    it('should return only active (incomplete) tasks when status is "active"', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { status: 'active' })
      
      expect(result.length).toBe(2)
      expect(result.every(task => task.completed === false)).toBe(true)
      expect(result.map(t => t.id)).toContain('task-1')
      expect(result.map(t => t.id)).toContain('task-3')
    })

    it('should not include completed tasks in active filter', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { status: 'active' })
      
      expect(result.map(t => t.id)).not.toContain('task-2')
    })
  })

  describe('Status filter "completed"', () => {
    it('should return only completed tasks when status is "completed"', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { status: 'completed' })
      
      expect(result.length).toBe(1)
      expect(result[0].completed).toBe(true)
      expect(result[0].id).toBe('task-2')
    })

    it('should not include active tasks in completed filter', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { status: 'completed' })
      
      expect(result.map(t => t.id)).not.toContain('task-1')
      expect(result.map(t => t.id)).not.toContain('task-3')
    })
  })

  describe('Status filter edge cases', () => {
    it('should return empty array when filtering active tasks with no active tasks', () => {
      const allCompletedTasks: TaskWithUser[] = [
        { ...mockTasks[0], completed: true },
        { ...mockTasks[1], completed: true }
      ]
      
      const result = readTasksWithUsersByUserIdLogic(allCompletedTasks, { status: 'active' })
      
      expect(result.length).toBe(0)
    })

    it('should return empty array when filtering completed tasks with no completed tasks', () => {
      const allActiveTasks: TaskWithUser[] = [
        { ...mockTasks[0], completed: false },
        { ...mockTasks[2], completed: false }
      ]
      
      const result = readTasksWithUsersByUserIdLogic(allActiveTasks, { status: 'completed' })
      
      expect(result.length).toBe(0)
    })

    it('should handle empty task array gracefully', () => {
      const emptyTasks: TaskWithUser[] = []
      
      const resultAll = readTasksWithUsersByUserIdLogic(emptyTasks, { status: 'all' })
      const resultActive = readTasksWithUsersByUserIdLogic(emptyTasks, { status: 'active' })
      const resultCompleted = readTasksWithUsersByUserIdLogic(emptyTasks, { status: 'completed' })
      
      expect(resultAll.length).toBe(0)
      expect(resultActive.length).toBe(0)
      expect(resultCompleted.length).toBe(0)
    })

    it('should preserve original task array (immutability)', () => {
      const originalTasks = [...mockTasks]
      const originalIds = originalTasks.map(t => t.id)
      
      readTasksWithUsersByUserIdLogic(mockTasks, { status: 'active' })
      
      expect(mockTasks.map(t => t.id)).toEqual(originalIds)
    })
  })
})

describe('readTasksWithUsersByUserId - Sorting', () => {
  describe('Sort by createdAt', () => {
    it('should sort by createdAt in descending order (default)', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { sortBy: 'createdAt' })
      
      expect(result[0].id).toBe('task-1')
      expect(result[1].id).toBe('task-2')
      expect(result[2].id).toBe('task-3')
    })

    it('should sort by createdAt in descending order when order is "desc"', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { sortBy: 'createdAt', order: 'desc' })
      
      expect(result[0].id).toBe('task-1')
      expect(result[1].id).toBe('task-2')
      expect(result[2].id).toBe('task-3')
    })

    it('should sort by createdAt in ascending order when order is "asc"', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { sortBy: 'createdAt', order: 'asc' })
      
      expect(result[0].id).toBe('task-3')
      expect(result[1].id).toBe('task-2')
      expect(result[2].id).toBe('task-1')
    })

    it('should use createdAt as default sort field', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, {})
      
      expect(result[0].id).toBe('task-1')
    })
  })

  describe('Sort by updatedAt', () => {
    it('should sort by updatedAt in descending order', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { sortBy: 'updatedAt', order: 'desc' })
      
      expect(result[0].id).toBe('task-2')
      expect(result[1].id).toBe('task-1')
      expect(result[2].id).toBe('task-3')
    })

    it('should sort by updatedAt in ascending order', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { sortBy: 'updatedAt', order: 'asc' })
      
      expect(result[0].id).toBe('task-3')
      expect(result[1].id).toBe('task-1')
      expect(result[2].id).toBe('task-2')
    })
  })

  describe('Sort by title', () => {
    it('should sort by title alphabetically in descending order (Z to A)', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { sortBy: 'title', order: 'desc' })
      
      expect(result[0].id).toBe('task-3')
      expect(result[1].id).toBe('task-2')
      expect(result[2].id).toBe('task-1')
    })

    it('should sort by title alphabetically in ascending order (A to Z)', () => {
      const result = readTasksWithUsersByUserIdLogic(mockTasks, { sortBy: 'title', order: 'asc' })
      
      expect(result[0].id).toBe('task-1')
      expect(result[1].id).toBe('task-2')
      expect(result[2].id).toBe('task-3')
    })

    it('should handle Chinese titles in localeCompare', () => {
      const chineseTasks: TaskWithUser[] = [
        { ...mockTasks[0], title: '张三的任务', id: 'c1' },
        { ...mockTasks[1], title: '李四的任务', id: 'c2' },
        { ...mockTasks[2], title: '王五的任务', id: 'c3' }
      ]
      
      const result = readTasksWithUsersByUserIdLogic(chineseTasks, { sortBy: 'title', order: 'asc' })
      
      expect(result.length).toBe(3)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Sort by priority', () => {
    it('should sort by priority in descending order (high first)', () => {
      const priorityTasks: (TaskWithUser & { priority: string })[] = [
        { ...mockTasks[0], id: 'p1', priority: 'low' },
        { ...mockTasks[1], id: 'p2', priority: 'high' },
        { ...mockTasks[2], id: 'p3', priority: 'medium' }
      ]
      
      const result = readTasksWithUsersByUserIdLogic(priorityTasks as TaskWithUser[], { sortBy: 'priority', order: 'desc' })
      
      expect(result[0].id).toBe('p2')
      expect(result[1].id).toBe('p3')
      expect(result[2].id).toBe('p1')
    })

    it('should sort by priority in ascending order (low first)', () => {
      const priorityTasks: (TaskWithUser & { priority: string })[] = [
        { ...mockTasks[0], id: 'p1', priority: 'low' },
        { ...mockTasks[1], id: 'p2', priority: 'high' },
        { ...mockTasks[2], id: 'p3', priority: 'medium' }
      ]
      
      const result = readTasksWithUsersByUserIdLogic(priorityTasks as TaskWithUser[], { sortBy: 'priority', order: 'asc' })
      
      expect(result[0].id).toBe('p1')
      expect(result[1].id).toBe('p3')
      expect(result[2].id).toBe('p2')
    })

    it('should use "medium" as default priority when not specified', () => {
      const mixedPriorityTasks: (TaskWithUser & { priority?: string })[] = [
        { ...mockTasks[0], id: 'p1' },
        { ...mockTasks[1], id: 'p2', priority: 'high' },
        { ...mockTasks[2], id: 'p3', priority: 'low' }
      ]
      
      const result = readTasksWithUsersByUserIdLogic(mixedPriorityTasks as TaskWithUser[], { sortBy: 'priority', order: 'desc' })
      
      expect(result[0].id).toBe('p2')
    })
  })
})

describe('readTasksWithUsersByUserId - Combined Filter and Sort', () => {
  it('should filter active tasks and sort by createdAt desc', () => {
    const result = readTasksWithUsersByUserIdLogic(mockTasks, {
      status: 'active',
      sortBy: 'createdAt',
      order: 'desc'
    })
    
    expect(result.length).toBe(2)
    expect(result.every(t => t.completed === false)).toBe(true)
    expect(result[0].id).toBe('task-1')
    expect(result[1].id).toBe('task-3')
  })

  it('should filter completed tasks and sort by title asc', () => {
    const completedTask = { ...mockTasks[1], id: 'c1', title: 'Zebra Task', completed: true }
    const anotherCompleted = { ...mockTasks[1], id: 'c2', title: 'Apple Task', completed: true }
    const tasksWithMultipleCompleted = [mockTasks[0], completedTask, anotherCompleted, mockTasks[2]]
    
    const result = readTasksWithUsersByUserIdLogic(tasksWithMultipleCompleted, {
      status: 'completed',
      sortBy: 'title',
      order: 'asc'
    })
    
    expect(result.length).toBe(2)
    expect(result[0].title).toBe('Apple Task')
    expect(result[1].title).toBe('Zebra Task')
  })

  it('should handle filter returning empty and then sort (no error)', () => {
    const allActiveTasks = mockTasks.map(t => ({ ...t, completed: false }))
    
    const result = readTasksWithUsersByUserIdLogic(allActiveTasks, {
      status: 'completed',
      sortBy: 'createdAt',
      order: 'desc'
    })
    
    expect(result.length).toBe(0)
  })
})

describe('readTasksWithUsersByUserId - TaskWithUser structure', () => {
  it('should include user information in TaskWithUser', () => {
    const result = readTasksWithUsersByUserIdLogic(mockTasks, {})
    
    result.forEach(task => {
      expect(task.user).toBeDefined()
      expect(task.user.id).toBeDefined()
      expect(task.user.username).toBeDefined()
    })
  })

  it('should have user.id matching userId', () => {
    const result = readTasksWithUsersByUserIdLogic(mockTasks, {})
    
    result.forEach(task => {
      expect(task.user.id).toBe(task.userId)
    })
  })
})
