<template>
  <div class="message-monitor">
    <div class="monitor-header">
      <h3>消息监控</h3>
      <div class="header-actions">
        <button 
          @click="toggleMonitoring" 
          class="action-btn"
          :class="{ active: isMonitoring }"
        >
          {{ isMonitoring ? '暂停监听' : '开始监听' }}
        </button>
        <button 
          @click="clearMessages" 
          class="action-btn clear"
          :disabled="messages.length === 0"
        >
          清除记录
        </button>
      </div>
    </div>

    <div class="monitor-stats">
      <div class="stat-item">
        <span class="stat-label">总消息数:</span>
        <span class="stat-value">{{ messages.length }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">状态:</span>
        <span class="stat-value" :class="{ active: isMonitoring }">
          {{ isMonitoring ? '监听中' : '已暂停' }}
        </span>
      </div>
    </div>

    <div class="message-list" v-if="messages.length > 0">
      <div 
        v-for="(msg, index) in messages" 
        :key="msg.id" 
        class="message-item"
        :class="getTypeClass(msg.type)"
        @click="toggleMessageExpand(msg.id)"
      >
        <div class="message-header">
          <span class="message-type">{{ msg.type }}</span>
          <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          <span class="expand-icon">{{ expandedId === msg.id ? '收起' : '展开' }}</span>
        </div>
        
        <div v-if="expandedId === msg.id" class="message-body">
          <div class="message-section">
            <h4>数据内容:</h4>
            <pre class="message-data">{{ JSON.stringify(msg.data, null, 2) }}</pre>
          </div>
          
          <div v-if="msg.userId" class="message-section">
            <h4>用户ID:</h4>
            <span class="user-id">{{ msg.userId }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-messages">
      <p>暂无消息记录</p>
      <p class="hint" v-if="!isConnected">WebSocket 未连接，请先连接后再发送消息</p>
      <p class="hint" v-else-if="!isMonitoring">点击"开始监听"按钮开始接收消息</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WebSocketMessage, WebSocketMessageType } from '~/server/utils/ws-events'

const { onAny, isConnected } = useWebSocket()

interface MessageWithId extends WebSocketMessage {
  id: string
}

const isMonitoring = ref(true)
const messages = ref<MessageWithId[]>([])
const expandedId = ref<string | null>(null)

let unsubAny: (() => void) | null = null

const subscribeToMessages = () => {
  if (unsubAny) {
    unsubAny()
  }
  
  unsubAny = onAny((message: WebSocketMessage) => {
    if (isMonitoring.value) {
      const msgWithId: MessageWithId = {
        ...message,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      }
      
      messages.value.unshift(msgWithId)
      
      if (messages.value.length > 100) {
        messages.value.pop()
      }
    }
  })
}

const unsubscribeFromMessages = () => {
  if (unsubAny) {
    unsubAny()
    unsubAny = null
  }
}

const toggleMonitoring = () => {
  isMonitoring.value = !isMonitoring.value
}

const clearMessages = () => {
  messages.value = []
  expandedId.value = null
}

const toggleMessageExpand = (id: string) => {
  if (expandedId.value === id) {
    expandedId.value = null
  } else {
    expandedId.value = id
  }
}

const getTypeClass = (type: WebSocketMessageType): string => {
  const classMap: Record<WebSocketMessageType, string> = {
    connected: 'type-connected',
    pong: 'type-pong',
    task_created: 'type-task',
    task_updated: 'type-task',
    task_deleted: 'type-task',
    notification: 'type-notification',
    error: 'type-error'
  }
  
  return classMap[type] || 'type-default'
}

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

onMounted(() => {
  subscribeToMessages()
})

onBeforeUnmount(() => {
  unsubscribeFromMessages()
})
</script>

<style scoped>
.message-monitor {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 800px;
  width: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.monitor-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.2rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: #6c757d;
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: #5a6268;
}

.action-btn.active {
  background: #00dc82;
}

.action-btn.active:hover {
  background: #00c471;
}

.action-btn.clear {
  background: #dc3545;
}

.action-btn.clear:hover:not(:disabled) {
  background: #c82333;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.monitor-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: white;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-label {
  color: #666;
  font-size: 0.9rem;
}

.stat-value {
  font-weight: 600;
  color: #333;
}

.stat-value.active {
  color: #00dc82;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.message-item {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 4px solid #6c757d;
}

.message-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message-item.type-connected {
  border-left-color: #00dc82;
}

.message-item.type-pong {
  border-left-color: #17a2b8;
}

.message-item.type-task {
  border-left-color: #ffc107;
}

.message-item.type-notification {
  border-left-color: #007bff;
}

.message-item.type-error {
  border-left-color: #dc3545;
}

.message-item.type-default {
  border-left-color: #6c757d;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
}

.message-type {
  font-weight: 600;
  color: #333;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  font-size: 0.85rem;
}

.message-time {
  color: #999;
  font-size: 0.8rem;
}

.expand-icon {
  color: #666;
  font-size: 0.75rem;
}

.message-body {
  padding: 0 1rem 1rem;
  border-top: 1px solid #eee;
}

.message-section {
  margin-top: 1rem;
}

.message-section h4 {
  margin: 0 0 0.5rem;
  color: #666;
  font-size: 0.85rem;
  font-weight: 500;
}

.message-data {
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
}

.user-id {
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.no-messages {
  text-align: center;
  padding: 2rem;
  color: #999;
}

.no-messages p {
  margin: 0.5rem 0;
  font-size: 0.95rem;
}

.no-messages .hint {
  font-size: 0.85rem;
  color: #aaa;
}
</style>
