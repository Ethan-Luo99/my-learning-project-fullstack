import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('~/server/utils/websocket', () => {
  const mockGetActiveConnections = vi.fn()
  const mockSendTaskEventToUser = vi.fn()
  const mockOnWebSocketConnection = vi.fn()
  
  return {
    getActiveConnections: mockGetActiveConnections,
    sendTaskEventToUser: mockSendTaskEventToUser,
    sendTaskEventBroadcast: vi.fn(),
    onWebSocketConnection: mockOnWebSocketConnection
  }
})

import {
  addOfflineMessage,
  getOfflineMessages,
  removeOfflineMessage,
  clearOfflineMessages,
  smartPushToUser,
  deliverOfflineMessages,
  getOfflineMessageStats,
  type TaskAction
} from '~/server/utils/task-events'
import {
  getActiveConnections,
  sendTaskEventToUser,
  onWebSocketConnection
} from '~/server/utils/websocket'
import type { TaskEventData } from '~/server/utils/ws-events'

function createTestEventData(taskId: string, action: TaskAction): TaskEventData {
  return {
    taskId,
    action,
    task: {
      id: taskId,
      title: `Test Task ${taskId}`,
      description: 'Test description',
      completed: false,
      userId: 'user-1'
    }
  }
}

describe('Offline Message Queue - Core Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getActiveConnections).mockReturnValue(undefined)
    vi.mocked(sendTaskEventToUser).mockReset()
    vi.mocked(onWebSocketConnection).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('addOfflineMessage', () => {
    it('should add offline message to queue', () => {
      const userId = 'test-user-001'
      const eventData = createTestEventData('task-1', 'created')
      
      const message = addOfflineMessage(userId, 'created', eventData)
      
      expect(message).toBeDefined()
      expect(message.id).toBeDefined()
      expect(message.userId).toBe(userId)
      expect(message.type).toBe('task_created')
      expect(message.data).toEqual(eventData)
      expect(message.timestamp).toBeDefined()
    })

    it('should add multiple messages to the same user', () => {
      const userId = 'test-user-002'
      
      addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      addOfflineMessage(userId, 'updated', createTestEventData('task-1', 'updated'))
      addOfflineMessage(userId, 'deleted', createTestEventData('task-1', 'deleted'))
      
      const messages = getOfflineMessages(userId)
      expect(messages.length).toBe(3)
    })
  })

  describe('getOfflineMessages', () => {
    it('should return empty array for user with no messages', () => {
      const userId = 'non-existent-user'
      const messages = getOfflineMessages(userId)
      
      expect(messages).toEqual([])
      expect(messages.length).toBe(0)
    })

    it('should return all valid messages for user', () => {
      const userId = 'test-user-003'
      
      addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      addOfflineMessage(userId, 'updated', createTestEventData('task-1', 'updated'))
      
      const messages = getOfflineMessages(userId)
      expect(messages.length).toBe(2)
      expect(messages[0].type).toBe('task_created')
      expect(messages[1].type).toBe('task_updated')
    })
  })

  describe('removeOfflineMessage', () => {
    it('should remove specific message from queue', () => {
      const userId = 'test-user-004'
      
      const msg1 = addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      const msg2 = addOfflineMessage(userId, 'updated', createTestEventData('task-1', 'updated'))
      
      let messages = getOfflineMessages(userId)
      expect(messages.length).toBe(2)
      
      const removed = removeOfflineMessage(userId, msg1.id)
      expect(removed).toBe(true)
      
      messages = getOfflineMessages(userId)
      expect(messages.length).toBe(1)
      expect(messages[0].id).toBe(msg2.id)
    })

    it('should return false when message not found', () => {
      const userId = 'test-user-005'
      addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      
      const removed = removeOfflineMessage(userId, 'non-existent-message-id')
      expect(removed).toBe(false)
    })

    it('should return false when user has no messages', () => {
      const removed = removeOfflineMessage('non-existent-user', 'any-id')
      expect(removed).toBe(false)
    })
  })

  describe('clearOfflineMessages', () => {
    it('should clear all messages for user', () => {
      const userId = 'test-user-006'
      
      addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      addOfflineMessage(userId, 'updated', createTestEventData('task-1', 'updated'))
      addOfflineMessage(userId, 'deleted', createTestEventData('task-1', 'deleted'))
      
      let messages = getOfflineMessages(userId)
      expect(messages.length).toBe(3)
      
      clearOfflineMessages(userId)
      
      messages = getOfflineMessages(userId)
      expect(messages.length).toBe(0)
    })

    it('should handle clearing messages for non-existent user', () => {
      expect(() => {
        clearOfflineMessages('non-existent-user')
      }).not.toThrow()
    })
  })
})

describe('Offline Message Queue - Smart Push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('smartPushToUser - User Online', () => {
    it('should send directly when user is online', () => {
      const userId = 'online-user'
      const eventData = createTestEventData('task-1', 'created')
      
      vi.mocked(getActiveConnections).mockReturnValue([{ readyState: 1 } as any])
      
      const result = smartPushToUser(userId, 'created', eventData)
      
      expect(result).toBe(true)
      expect(sendTaskEventToUser).toHaveBeenCalledWith(userId, eventData)
    })
  })

  describe('smartPushToUser - User Offline', () => {
    it('should queue message when user is offline', () => {
      const userId = 'offline-user-001'
      const eventData = createTestEventData('task-1', 'created')
      
      vi.mocked(getActiveConnections).mockReturnValue(undefined)
      
      const result = smartPushToUser(userId, 'created', eventData)
      
      expect(result).toBe(false)
      expect(sendTaskEventToUser).not.toHaveBeenCalled()
      
      const messages = getOfflineMessages(userId)
      expect(messages.length).toBe(1)
    })

    it('should queue multiple messages when user is offline', () => {
      const userId = 'offline-user-002'
      
      vi.mocked(getActiveConnections).mockReturnValue(undefined)
      
      smartPushToUser(userId, 'created', createTestEventData('task-1', 'created'))
      smartPushToUser(userId, 'updated', createTestEventData('task-1', 'updated'))
      smartPushToUser(userId, 'deleted', createTestEventData('task-1', 'deleted'))
      
      const messages = getOfflineMessages(userId)
      expect(messages.length).toBe(3)
      expect(sendTaskEventToUser).not.toHaveBeenCalled()
    })
  })
})

describe('Offline Message Queue - Queue Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getActiveConnections).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Queue Size Limit (100 messages)', () => {
    it('should limit queue to 100 messages per user', () => {
      const userId = 'queue-limit-user'
      
      for (let i = 0; i < 105; i++) {
        const eventData = createTestEventData(`task-${i}`, 'created')
        addOfflineMessage(userId, 'created', eventData)
      }
      
      const messages = getOfflineMessages(userId)
      expect(messages.length).toBe(100)
    })

    it('should keep newest messages when queue overflows', () => {
      const userId = 'queue-newest-user'
      
      for (let i = 0; i < 105; i++) {
        const eventData = {
          taskId: `task-${i}`,
          action: 'created' as TaskAction
        }
        addOfflineMessage(userId, 'created', eventData)
      }
      
      const messages = getOfflineMessages(userId)
      
      expect(messages[0].data.taskId).toBe('task-5')
      expect(messages[99].data.taskId).toBe('task-104')
    })
  })

  describe('Message Expiration (7 days)', () => {
    it('should filter out expired messages (8 days old)', () => {
      const userId = 'expiration-test-user'
      
      const now = Date.now()
      const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000)
      
      vi.setSystemTime(eightDaysAgo)
      
      addOfflineMessage(userId, 'created', createTestEventData('task-expired', 'created'))
      
      vi.setSystemTime(now)
      
      const messages = getOfflineMessages(userId)
      
      expect(messages.length).toBe(0)
    })

    it('should return only valid messages', () => {
      const userId = 'valid-messages-user'
      
      addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      addOfflineMessage(userId, 'updated', createTestEventData('task-1', 'updated'))
      
      const messages = getOfflineMessages(userId)
      expect(messages.length).toBe(2)
    })
  })
})

describe('Offline Message Queue - Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getActiveConnections).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getOfflineMessageStats', () => {
    it('should return correct statistics', () => {
      const user1 = 'stats-user-1'
      const user2 = 'stats-user-2'
      const user3 = 'stats-user-3'
      
      clearOfflineMessages(user1)
      clearOfflineMessages(user2)
      clearOfflineMessages(user3)
      
      addOfflineMessage(user1, 'created', createTestEventData('task-1', 'created'))
      
      addOfflineMessage(user2, 'created', createTestEventData('task-2', 'created'))
      addOfflineMessage(user2, 'updated', createTestEventData('task-2', 'updated'))
      
      addOfflineMessage(user3, 'created', createTestEventData('task-3', 'created'))
      addOfflineMessage(user3, 'updated', createTestEventData('task-3', 'updated'))
      addOfflineMessage(user3, 'deleted', createTestEventData('task-3', 'deleted'))
      
      const stats = getOfflineMessageStats()
      
      expect(stats.totalUsers).toBeGreaterThanOrEqual(3)
      expect(stats.totalMessages).toBeGreaterThanOrEqual(6)
      
      const user1Stats = stats.usersWithMessages.find(u => u.userId === user1)
      const user2Stats = stats.usersWithMessages.find(u => u.userId === user2)
      const user3Stats = stats.usersWithMessages.find(u => u.userId === user3)
      
      expect(user1Stats?.messageCount).toBe(1)
      expect(user2Stats?.messageCount).toBe(2)
      expect(user3Stats?.messageCount).toBe(3)
    })

    it('should handle empty queue', () => {
      const stats = getOfflineMessageStats()
      expect(typeof stats.totalUsers).toBe('number')
      expect(typeof stats.totalMessages).toBe('number')
      expect(Array.isArray(stats.usersWithMessages)).toBe(true)
    })
  })
})

describe('Offline Message Queue - Message Delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('deliverOfflineMessages', () => {
    it('should return empty array when user has no messages', () => {
      const userId = 'no-messages-user'
      vi.mocked(getActiveConnections).mockReturnValue([{ readyState: 1, send: vi.fn() } as any])
      
      const delivered = deliverOfflineMessages(userId)
      expect(delivered).toEqual([])
      expect(delivered.length).toBe(0)
    })

    it('should return empty array when user is offline', () => {
      const userId = 'still-offline-user'
      
      vi.mocked(getActiveConnections).mockReturnValue(undefined)
      addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      
      const delivered = deliverOfflineMessages(userId)
      expect(delivered).toEqual([])
      
      const messages = getOfflineMessages(userId)
      expect(messages.length).toBe(1)
    })

    it('should deliver messages when user is online', () => {
      const userId = 'delivery-test-user'
      const mockWsSend = vi.fn()
      
      vi.mocked(getActiveConnections).mockReturnValue([{ readyState: 1, send: mockWsSend } as any])
      
      addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      addOfflineMessage(userId, 'updated', createTestEventData('task-1', 'updated'))
      
      const delivered = deliverOfflineMessages(userId)
      
      expect(delivered.length).toBe(2)
      expect(mockWsSend).toHaveBeenCalledTimes(2)
      
      const messages = getOfflineMessages(userId)
      expect(messages.length).toBe(0)
    })

    it('should call getActiveConnections only once (performance optimization)', () => {
      const userId = 'performance-test-user'
      const mockWsSend = vi.fn()
      
      vi.mocked(getActiveConnections).mockReturnValue([{ readyState: 1, send: mockWsSend } as any])
      
      for (let i = 0; i < 50; i++) {
        addOfflineMessage(userId, 'created', createTestEventData(`task-${i}`, 'created'))
      }
      
      vi.mocked(getActiveConnections).mockClear()
      vi.mocked(getActiveConnections).mockReturnValue([{ readyState: 1, send: mockWsSend } as any])
      
      deliverOfflineMessages(userId)
      
      expect(getActiveConnections).toHaveBeenCalledTimes(1)
    })
  })
})

describe('Offline Message Queue - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Send Failure Handling', () => {
    it('should retain message when send fails', () => {
      const userId = 'send-failure-user'
      const mockWsSend = vi.fn(() => {
        throw new Error('WebSocket send failed')
      })
      
      vi.mocked(getActiveConnections).mockReturnValue([{ readyState: 1, send: mockWsSend } as any])
      
      addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      
      const delivered = deliverOfflineMessages(userId)
      
      expect(delivered.length).toBe(0)
      
      const messages = getOfflineMessages(userId)
      expect(messages.length).toBe(1)
    })

    it('should handle partial send failures', () => {
      const userId = 'partial-failure-user'
      let callCount = 0
      const mockWsSend = vi.fn(() => {
        callCount++
        if (callCount === 2) {
          throw new Error('Send failed on second message')
        }
      })
      
      vi.mocked(getActiveConnections).mockReturnValue([{ readyState: 1, send: mockWsSend } as any])
      
      const msg1 = addOfflineMessage(userId, 'created', createTestEventData('task-1', 'created'))
      const msg2 = addOfflineMessage(userId, 'updated', createTestEventData('task-1', 'updated'))
      const msg3 = addOfflineMessage(userId, 'deleted', createTestEventData('task-1', 'deleted'))
      
      const delivered = deliverOfflineMessages(userId)
      
      expect(mockWsSend).toHaveBeenCalledTimes(3)
      
      const deliveredIds = delivered.map(m => m.id)
      expect(deliveredIds).toContain(msg1.id)
      expect(deliveredIds).not.toContain(msg2.id)
      expect(deliveredIds).toContain(msg3.id)
      
      expect(delivered.length).toBe(2)
      
      const remainingMessages = getOfflineMessages(userId)
      expect(remainingMessages.length).toBe(1)
      expect(remainingMessages[0].id).toBe(msg2.id)
    })
  })
})
