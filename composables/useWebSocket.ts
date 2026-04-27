import type { WebSocketMessage, WebSocketMessageType, TaskEventData, NotificationEventData, ErrorEventData } from '~/server/utils/ws-events'

interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  reconnectAttempts: number
  error: string | null
  lastMessage: WebSocketMessage | null
  messageQueueSize: number
}

type MessageHandler<T = any> = (message: WebSocketMessage<T>) => void | Promise<void>
type OnceHandler<T = any> = (message: WebSocketMessage<T>) => void | Promise<void>
type WildcardHandler = (message: WebSocketMessage) => void | Promise<void>

interface MessageQueueItem {
  message: any
  timestamp: number
  priority: 'high' | 'normal' | 'low'
  retryCount: number
}

const WS_PATH = '/ws'
const BASE_RECONNECT_DELAY = 3000
const MAX_RECONNECT_DELAY = 30000
const MAX_RECONNECT_ATTEMPTS = 10
const MAX_MESSAGE_QUEUE_SIZE = 100
const MESSAGE_QUEUE_EXPIRY = 5 * 60 * 1000
const MAX_MESSAGE_RETRY_COUNT = 5

let ws: WebSocket | null = null
let reconnectAttempts = 0
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let messageHandlers: Map<WebSocketMessageType, MessageHandler[]> = new Map()
let onceHandlers: Map<WebSocketMessageType, OnceHandler[]> = new Map()
let wildcardHandlers: WildcardHandler[] = []
let messageQueue: MessageQueueItem[] = []
let isInitialized = false

export const useWebSocket = () => {
  const { token } = useAuth()
  
  const state = useState<WebSocketState>('websocket', () => ({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    error: null,
    lastMessage: null,
    messageQueueSize: 0
  }))

  const isConnected = computed(() => state.value.isConnected)
  const isConnecting = computed(() => state.value.isConnecting)
  const isReconnecting = computed(() => state.value.isReconnecting)
  const reconnectAttempts = computed(() => state.value.reconnectAttempts)
  const maxReconnectAttempts = computed(() => MAX_RECONNECT_ATTEMPTS)
  const error = computed(() => state.value.error)
  const lastMessage = computed(() => state.value.lastMessage)

  const connect = () => {
    if (!process.client) return
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    if (!token.value) {
      state.value.error = 'No authentication token available'
      return
    }

    state.value.isConnecting = true
    state.value.error = null

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}${WS_PATH}?token=${encodeURIComponent(token.value)}`
      
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        state.value.isConnected = true
        state.value.isConnecting = false
        state.value.isReconnecting = false
        state.value.reconnectAttempts = 0
        state.value.error = null
        reconnectAttempts = 0
        console.log('WebSocket connected')
        flushMessageQueue()
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          state.value.lastMessage = message
          
          wildcardHandlers.forEach(handler => {
            try {
              handler(message)
            } catch (e) {
              console.error('Wildcard handler error:', e)
            }
          })
          
          const handlers = messageHandlers.get(message.type)
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(message)
              } catch (e) {
                console.error(`Message handler error for type ${message.type}:`, e)
              }
            })
          }
          
          const onceHandles = onceHandlers.get(message.type)
          if (onceHandles && onceHandles.length > 0) {
            const handlersCopy = [...onceHandles]
            onceHandlers.delete(message.type)
            
            handlersCopy.forEach(handler => {
              try {
                handler(message)
              } catch (e) {
                console.error(`Once handler error for type ${message.type}:`, e)
              }
            })
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      ws.onclose = (event) => {
        state.value.isConnected = false
        state.value.isConnecting = false
        
        if (!event.wasClean) {
          state.value.error = `WebSocket connection closed unexpectedly (code: ${event.code})`
          attemptReconnect()
        }
        
        console.log('WebSocket closed:', event.code, event.reason)
      }

      ws.onerror = (error) => {
        state.value.error = 'WebSocket connection error'
        state.value.isConnecting = false
        console.error('WebSocket error:', error)
      }
    } catch (e) {
      state.value.error = 'Failed to create WebSocket connection'
      state.value.isConnecting = false
      console.error('WebSocket creation error:', e)
    }
  }

  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    
    if (ws) {
      ws.close(1000, 'User initiated disconnect')
      ws = null
    }
    
    messageHandlers.clear()
    onceHandlers.clear()
    wildcardHandlers = []
    
    state.value.isConnected = false
    state.value.isConnecting = false
    state.value.isReconnecting = false
    state.value.reconnectAttempts = 0
    reconnectAttempts = 0
  }

  const attemptReconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      state.value.error = 'Max reconnection attempts reached'
      state.value.isReconnecting = false
      return
    }

    reconnectAttempts++
    state.value.isReconnecting = true
    state.value.reconnectAttempts = reconnectAttempts

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    )
    
    console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`)
    
    reconnectTimeout = setTimeout(() => {
      if (token.value) {
        connect()
      }
    }, delay)
  }

  const enqueueMessage = (message: any, priority: 'high' | 'normal' | 'low' = 'normal'): boolean => {
    if (messageQueue.length >= MAX_MESSAGE_QUEUE_SIZE) {
      if (priority === 'low') {
        return false
      }
      const lowPriorityIndex = messageQueue.findIndex(m => m.priority === 'low')
      if (lowPriorityIndex > -1) {
        messageQueue.splice(lowPriorityIndex, 1)
      } else {
        const normalPriorityIndex = messageQueue.findIndex(m => m.priority === 'normal')
        if (normalPriorityIndex > -1) {
          messageQueue.splice(normalPriorityIndex, 1)
        } else {
          return false
        }
      }
    }
    
    messageQueue.push({
      message,
      timestamp: Date.now(),
      priority,
      retryCount: 0
    })
    
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    messageQueue.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      return a.timestamp - b.timestamp
    })
    
    state.value.messageQueueSize = messageQueue.length
    return true
  }

  const flushMessageQueue = (): number => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return 0
    }
    
    const now = Date.now()
    let flushedCount = 0
    
    messageQueue = messageQueue.filter(item => {
      if (now - item.timestamp > MESSAGE_QUEUE_EXPIRY) {
        console.log('Expired message in queue, skipping:', item.message)
        return false
      }
      
      try {
        const messageStr = typeof item.message === 'string' ? item.message : JSON.stringify(item.message)
        ws.send(messageStr)
        flushedCount++
        return false
      } catch (e) {
        item.retryCount++
        if (item.retryCount >= MAX_MESSAGE_RETRY_COUNT) {
          console.error('Max retry count reached, dropping message:', item.message, e)
          return false
        }
        console.warn(`Failed to send queued message (retry ${item.retryCount}/${MAX_MESSAGE_RETRY_COUNT}):`, e)
        return true
      }
    })
    
    state.value.messageQueueSize = messageQueue.length
    console.log(`Flushed ${flushedCount} messages from queue`)
    return flushedCount
  }

  const clearMessageQueue = (): void => {
    messageQueue = []
    state.value.messageQueueSize = 0
  }

  const send = (message: any, options: { queue?: boolean; priority?: 'high' | 'normal' | 'low' } = {}): boolean => {
    const { queue = false, priority = 'normal' } = options
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message)
        ws.send(messageStr)
        return true
      } catch (e) {
        console.error('Send error:', e)
        if (!queue) {
          state.value.error = 'Failed to send message'
          return false
        }
      }
    }
    
    if (queue) {
      return enqueueMessage(message, priority)
    }
    
    state.value.error = 'WebSocket is not connected'
    return false
  }

  const ping = (): boolean => {
    return send({ type: 'ping', timestamp: new Date().toISOString() })
  }

  const on = <T = any>(type: WebSocketMessageType, handler: MessageHandler<T>): () => void => {
    if (!messageHandlers.has(type)) {
      messageHandlers.set(type, [])
    }
    messageHandlers.get(type)!.push(handler as MessageHandler)
    
    return () => {
      const handlers = messageHandlers.get(type)
      if (handlers) {
        const index = handlers.indexOf(handler as MessageHandler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }
  }

  const once = <T = any>(type: WebSocketMessageType, handler: OnceHandler<T>): () => void => {
    if (!onceHandlers.has(type)) {
      onceHandlers.set(type, [])
    }
    onceHandlers.get(type)!.push(handler as OnceHandler)
    
    return () => {
      const handlers = onceHandlers.get(type)
      if (handlers) {
        const index = handlers.indexOf(handler as OnceHandler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }
  }

  const off = <T = any>(type: WebSocketMessageType, handler: MessageHandler<T>): void => {
    const handlers = messageHandlers.get(type)
    if (handlers) {
      const index = handlers.indexOf(handler as MessageHandler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  const onAny = (handler: WildcardHandler): () => void => {
    wildcardHandlers.push(handler)
    
    return () => {
      const index = wildcardHandlers.indexOf(handler)
      if (index > -1) {
        wildcardHandlers.splice(index, 1)
      }
    }
  }

  const onMessage = (type: WebSocketMessageType, handler: (message: WebSocketMessage) => void) => {
    return on(type, handler)
  }

  const clearError = () => {
    state.value.error = null
  }

  const initWebSocket = () => {
    if (isInitialized) return
    isInitialized = true

    if (process.client) {
      watch(token, (newToken, oldToken) => {
        if (newToken && !oldToken) {
          connect()
        } else if (!newToken && oldToken) {
          disconnect()
        }
      }, { immediate: true })
    }
  }

  const messageQueueSize = computed(() => state.value.messageQueueSize)

  return {
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempts,
    maxReconnectAttempts,
    error,
    lastMessage,
    messageQueueSize,
    connect,
    disconnect,
    send,
    ping,
    on,
    once,
    off,
    onAny,
    onMessage,
    enqueueMessage,
    flushMessageQueue,
    clearMessageQueue,
    clearError,
    initWebSocket
  }
}