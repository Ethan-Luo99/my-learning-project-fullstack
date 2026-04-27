<template>
  <div class="websocket-status">
    <div class="status-indicator" :class="statusClass">
      <span class="status-dot"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>
    
    <div class="status-actions" v-if="showActions">
      <div class="button-wrapper" :class="{ 'has-tooltip': !isAuthenticated }">
        <button 
          v-if="!isConnected && !isConnecting && !isReconnecting" 
          @click="handleConnect"
          class="action-btn connect"
          :disabled="!isAuthenticated"
        >
          连接
        </button>
        <span v-if="!isAuthenticated" class="tooltip">请先登录</span>
      </div>
      <div v-if="!isAuthenticated && !isConnected && !isConnecting && !isReconnecting" class="auth-hint">
        请先登录后再连接 WebSocket
      </div>
      <button 
        v-if="isConnected" 
        @click="handlePing"
        class="action-btn ping"
        :disabled="isPinging"
      >
        {{ isPinging ? '测试中...' : '测试连接' }}
      </button>
      <button 
        v-if="isConnected || isConnecting || isReconnecting" 
        @click="handleDisconnect"
        class="action-btn disconnect"
      >
        断开
      </button>
    </div>
    
    <div v-if="pingResult" :class="['ping-result', pingResult.type]">
      {{ pingResult.message }}
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
const { 
  isConnected, 
  isConnecting, 
  isReconnecting,
  reconnectAttempts,
  maxReconnectAttempts,
  error, 
  connect, 
  disconnect, 
  ping, 
  initWebSocket,
  onMessage
} = useWebSocket()
const { isAuthenticated } = useAuth()

interface Props {
  showActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true
})

interface PingResult {
  type: 'success' | 'error'
  message: string
}

const isPinging = ref(false)
const pingResult = ref<PingResult | null>(null)
let pingTimeout: ReturnType<typeof setTimeout> | null = null
let resultTimeout: ReturnType<typeof setTimeout> | null = null
let unsubPong: (() => void) | null = null

const statusClass = computed(() => {
  if (isReconnecting.value) return 'reconnecting'
  if (isConnecting.value) return 'connecting'
  if (isConnected.value) return 'connected'
  if (error.value) return 'error'
  return 'disconnected'
})

const statusText = computed(() => {
  if (isReconnecting.value) {
    return `正在重连 (${reconnectAttempts.value}/${maxReconnectAttempts.value})...`
  }
  if (isConnecting.value) return '连接中...'
  if (isConnected.value) return '已连接'
  if (error.value) return '连接错误'
  return '未连接'
})

const showPingResult = (type: 'success' | 'error', message: string) => {
  if (resultTimeout) {
    clearTimeout(resultTimeout)
  }
  
  pingResult.value = { type, message }
  
  resultTimeout = setTimeout(() => {
    pingResult.value = null
  }, 3000)
}

const handleConnect = () => {
  initWebSocket()
  if (!isConnecting.value && !isConnected.value) {
    connect()
  }
}

const handleDisconnect = () => {
  if (pingTimeout) {
    clearTimeout(pingTimeout)
    pingTimeout = null
  }
  if (unsubPong) {
    unsubPong()
    unsubPong = null
  }
  disconnect()
}

const handlePing = () => {
  if (isPinging.value) return
  
  isPinging.value = true
  pingResult.value = null
  
  unsubPong = onMessage('pong', () => {
    if (pingTimeout) {
      clearTimeout(pingTimeout)
      pingTimeout = null
    }
    isPinging.value = false
    showPingResult('success', 'Ping 成功 - 连接正常')
    if (unsubPong) {
      unsubPong()
      unsubPong = null
    }
  })
  
  const success = ping()
  
  if (!success) {
    isPinging.value = false
    if (unsubPong) {
      unsubPong()
      unsubPong = null
    }
    showPingResult('error', 'Ping 失败 - WebSocket 未连接')
    return
  }
  
  pingTimeout = setTimeout(() => {
    isPinging.value = false
    if (unsubPong) {
      unsubPong()
      unsubPong = null
    }
    showPingResult('error', 'Ping 超时 - 未收到响应')
  }, 5000)
}
</script>

<style scoped>
.websocket-status {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #999;
  transition: all 0.3s;
}

.status-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: #666;
}

.status-indicator.connecting {
  background: rgba(255, 193, 7, 0.1);
}

.status-indicator.connecting .status-dot {
  background: #ffc107;
  animation: pulse 1.5s infinite;
}

.status-indicator.connecting .status-text {
  color: #d39e00;
}

.status-indicator.reconnecting {
  background: rgba(255, 152, 0, 0.15);
}

.status-indicator.reconnecting .status-dot {
  background: #ff9800;
  animation: pulse 1.2s infinite;
}

.status-indicator.reconnecting .status-text {
  color: #e65100;
}

.status-indicator.connected {
  background: rgba(0, 220, 130, 0.1);
}

.status-indicator.connected .status-dot {
  background: #00dc82;
  box-shadow: 0 0 8px rgba(0, 220, 130, 0.5);
}

.status-indicator.connected .status-text {
  color: #00c471;
}

.status-indicator.error {
  background: rgba(220, 53, 69, 0.1);
}

.status-indicator.error .status-dot {
  background: #dc3545;
}

.status-indicator.error .status-text {
  color: #c82333;
}

.status-indicator.disconnected {
  background: rgba(108, 117, 125, 0.1);
}

.status-indicator.disconnected .status-dot {
  background: #6c757d;
}

.status-indicator.disconnected .status-text {
  color: #5a6268;
}

.status-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.button-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  position: relative;
}

.action-btn {
  position: relative;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-wrapper .tooltip {
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.4rem 0.8rem;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 0.8rem;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  z-index: 1000;
}

.button-wrapper .tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.8);
}

.button-wrapper:hover .tooltip,
.button-wrapper:focus .tooltip {
  opacity: 1;
  visibility: visible;
}

.auth-hint {
  font-size: 0.8rem;
  color: #6c757d;
  padding: 0.25rem 0.5rem;
  font-style: italic;
}

.action-btn.connect {
  background: #00dc82;
  color: white;
}

.action-btn.connect:hover:not(:disabled) {
  background: #00c471;
}

.action-btn.ping {
  background: #17a2b8;
  color: white;
}

.action-btn.ping:hover {
  background: #138496;
}

.action-btn.disconnect {
  background: #dc3545;
  color: white;
}

.action-btn.disconnect:hover {
  background: #c82333;
}

.error-message {
  font-size: 0.8rem;
  color: #dc3545;
  padding: 0.25rem 0.5rem;
}

.ping-result {
  font-size: 0.85rem;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  animation: fadeIn 0.3s ease-in;
}

.ping-result.success {
  background: rgba(0, 220, 130, 0.15);
  color: #00c471;
}

.ping-result.error {
  background: rgba(220, 53, 69, 0.15);
  color: #c82333;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}
</style>