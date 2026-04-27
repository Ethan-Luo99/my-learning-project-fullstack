<template>
  <div class="container">
    <h1>欢迎使用 Nuxt 3!</h1>
    <p v-if="isAuthenticated && user">
      欢迎回来, {{ user.username }}!
    </p>
    <p v-else>
      这是一个全栈项目演示, 请先登录或注册
    </p>

    <div class="action-buttons">
      <NuxtLink v-if="isAuthenticated" to="/tasks" class="btn-primary">
        进入任务管理
      </NuxtLink>
      <template v-else>
        <NuxtLink to="/login" class="btn-primary">
          立即登录
        </NuxtLink>
        <NuxtLink to="/register" class="btn-secondary">
          注册账户
        </NuxtLink>
      </template>
    </div>

    <div class="websocket-section">
      <h3>WebSocket 连接状态</h3>
      <WebSocketStatus />
    </div>

    <div class="message-monitor-section" v-if="isAuthenticated">
      <h3>消息监控</h3>
      <MessageMonitor />
    </div>

    <div class="api-test">
      <button @click="fetchHello">测试 API 路由</button>
      <p v-if="message">{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isAuthenticated, user, initAuth } = useAuth()
const { initWebSocket } = useWebSocket()

const message = ref<string>('')

onMounted(() => {
  initAuth()
  initWebSocket()
})

const fetchHello = async () => {
  try {
    const { data } = await useFetch('/api/hello')
    if (data.value) {
      message.value = (data.value as { message: string }).message
    }
  } catch (error) {
    console.error('Failed to fetch API:', error)
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  color: #00dc82;
  margin-bottom: 1rem;
}

p {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 2rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn-primary,
.btn-secondary {
  display: inline-block;
  padding: 1rem 2rem;
  border-radius: 8px;
  text-decoration: none;
  font-size: 1.1rem;
  font-weight: 600;
  transition: all 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, #00dc82 0%, #00c471 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 220, 130, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 220, 130, 0.4);
}

.btn-secondary {
  background: transparent;
  color: #00dc82;
  border: 2px solid #00dc82;
}

.btn-secondary:hover {
  background: rgba(0, 220, 130, 0.1);
}

.websocket-section {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.websocket-section h3 {
  font-size: 1.2rem;
  color: #333;
  margin: 0;
}

.message-monitor-section {
  margin-top: 2rem;
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.message-monitor-section h3 {
  font-size: 1.2rem;
  color: #333;
  margin: 0;
}

.api-test {
  margin-top: 2rem;
}

button {
  background: #00dc82;
  color: white;
  border: none;
  padding: 1rem 2rem;
  font-size: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

button:hover {
  background: #00c471;
}
</style>
