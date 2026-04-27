<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1>注册</h1>
      <p class="subtitle">创建一个新账户</p>

      <form @submit.prevent="handleRegister">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="请输入用户名"
            required
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="请输入密码（至少6位"
            required
            :disabled="isLoading"
          />
          <p v-if="form.password && form.password.length > 0 && form.password.length < 6" class="hint">
            密码长度至少6位
          </p>
        </div>

        <div class="form-group">
          <label for="confirmPassword">确认密码</label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            required
            :disabled="isLoading"
          />
          <p
            v-if="form.confirmPassword && form.password && form.password !== form.confirmPassword"
            class="hint error-hint"
          >
            两次输入的密码不一致
          </p>
        </div>

        <button type="submit" :disabled="isLoading || !isFormValid" class="submit-btn">
          {{ isLoading ? '注册中...' : '注册' }}
        </button>
      </form>

      <div class="links">
        <p>
          已有账户？
          <NuxtLink to="/login">立即登录</NuxtLink>
        </p>
        <NuxtLink to="/" class="home-link">返回首页</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isAuthenticated, register, isLoading } = useAuth()
const router = useRouter()
const route = useRoute()

const form = ref({
  username: '',
  password: '',
  confirmPassword: ''
})

const error = ref('')

const isFormValid = computed(() => {
  return (
    form.value.username.trim() !== '' &&
    form.value.password.length >= 6 &&
    form.value.password === form.value.confirmPassword
  )
})

watch(isAuthenticated, (isAuth) => {
  if (isAuth) {
    const redirect = (route.query.redirect as string | undefined)
    router.push(redirect || '/')
  }
})

onMounted(() => {
  if (isAuthenticated.value) {
    const redirect = (route.query.redirect as string | undefined)
    router.push(redirect || '/')
  }
})

const handleRegister = async () => {
  error.value = ''

  if (form.value.password.length < 6) {
    error.value = '密码长度至少6位'
    return
  }

  if (form.value.password !== form.value.confirmPassword) {
    error.value = '两次输入的密码不一致'
    return
  }

  const result = await register(form.value.username, form.value.password)
  
  if (!result.success) {
    error.value = result.error || '注册失败'
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-card {
  background: white;
  border-radius: 16px;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.auth-card h1 {
  font-size: 2rem;
  margin: 0 0 0.5rem 0;
  color: #333;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #444;
}

.form-group input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #00dc82;
  box-shadow: 0 0 0 3px rgba(0, 220, 130, 0.1);
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
  color: #888;
}

.hint-error {
  color: #ff4757;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #00dc82 0%, #00c471 100%);
  color: white;
  border: none;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 220, 130, 0.4);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-message {
  background: #fff0f0;
  color: #ff4757;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
  border-left: 4px solid #ff4757;
}

.links {
  margin-top: 1.5rem;
  text-align: center;
  color: #666;
  font-size: 0.95rem;
}

.links p {
  margin: 0 0 0.75rem 0;
}

.links a {
  color: #00dc82;
  text-decoration: none;
  font-weight: 500;
}

.links a:hover {
  text-decoration: underline;
}

.home-link {
  color: #888;
  text-decoration: none;
  font-size: 0.875rem;
}

.home-link:hover {
  color: #00dc82;
}
</style>
