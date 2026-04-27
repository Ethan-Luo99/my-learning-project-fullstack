import type { WebSocketMessage, WebSocketMessageType } from '~/server/utils/ws-events'

interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  reconnectAttempts: number
  error: string | null
  lastMessage: WebSocketMessage | null
}

const WS_PATH = '/ws'
const BASE_RECONNECT_DELAY = 3000
const MAX_RECONNECT_DELAY = 30000
const MAX_RECONNECT_ATTEMPTS = 10

let ws: WebSocket | null = null
let reconnectAttempts = 0
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let messageHandlers: Map<WebSocketMessageType, ((message: WebSocketMessage) => void)[]> = new Map()
let isInitialized = false

export const useWebSocket = () => {
  const { token } = useAuth()
  
  const state = useState<WebSocketState>('websocket', () => ({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    error: null,
    lastMessage: null
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
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          state.value.lastMessage = message
          
          const handlers = messageHandlers.get(message.type)
          if (handlers) {
            handlers.forEach(handler => handler(message))
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

  const send = (message: any): boolean => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      state.value.error = 'WebSocket is not connected'
      return false
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message)
      ws.send(messageStr)
      return true
    } catch (e) {
      state.value.error = 'Failed to send message'
      console.error('Send error:', e)
      return false
    }
  }

  const ping = (): boolean => {
    return send({ type: 'ping', timestamp: new Date().toISOString() })
  }

  const onMessage = (type: WebSocketMessageType, handler: (message: WebSocketMessage) => void) => {
    if (!messageHandlers.has(type)) {
      messageHandlers.set(type, [])
    }
    messageHandlers.get(type)!.push(handler)
    
    return () => {
      const handlers = messageHandlers.get(type)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }
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

  return {
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempts,
    maxReconnectAttempts,
    error,
    lastMessage,
    connect,
    disconnect,
    send,
    ping,
    onMessage,
    clearError,
    initWebSocket
  }
}