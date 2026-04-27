<template>
  <div class="profile-container">
    <div class="profile-card">
      <h1>个人资料</h1>
      <p class="subtitle">管理您的账户信息</p>

      <div v-if="isLoading" class="loading-container">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="loadError" class="error-message">
        {{ loadError }}
      </div>

      <div v-else class="profile-form">
        <div v-if="successMessage" class="success-message">
          {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <div class="avatar-section">
          <UserAvatarUpload
            @upload-success="handleAvatarUploadSuccess"
            @upload-error="handleAvatarUploadError"
            @delete-success="handleAvatarDeleteSuccess"
          />
        </div>

        <div class="form-group">
          <label for="userId">用户 ID</label>
          <input
            id="userId"
            :value="userData.id"
            type="text"
            disabled
            class="readonly-field"
          />
        </div>

        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="请输入用户名"
            :disabled="isSaving"
            :class="{
              'input-error': usernameValidation.error && form.username !== originalUsername,
              'input-valid': usernameValidation.valid && form.username !== originalUsername && form.username.trim() !== ''
            }"
            @input="validateUsernameField"
          />
          <p
            v-if="usernameValidation.error && form.username !== originalUsername"
            class="hint error-hint"
          >
            {{ usernameValidation.error }}
          </p>
          <p
            v-else-if="usernameValidation.valid && form.username !== originalUsername && form.username.trim() !== ''"
            class="hint valid-hint"
          >
            用户名格式正确
          </p>
        </div>

        <div class="form-group">
          <label for="createdAt">注册时间</label>
          <input
            id="createdAt"
            :value="formattedCreatedAt"
            type="text"
            disabled
            class="readonly-field"
          />
        </div>

        <div class="action-buttons">
          <button
            type="button"
            :disabled="!canSave"
            @click="handleSave"
            class="save-btn"
          >
            {{ isSaving ? '保存中...' : '保存修改' }}
          </button>
          <button
            type="button"
            :disabled="isSaving"
            @click="handleCancel"
            class="cancel-btn"
          >
            取消
          </button>
        </div>

        <div class="additional-links">
          <NuxtLink to="/change-password" class="link">修改密码</NuxtLink>
          <NuxtLink to="/" class="link">返回首页</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const { user, token, getAuthHeaders, setAuth } = useAuth()

interface UserProfile {
  id: string
  username: string
  avatar: string | null
  createdAt: string
}

interface UsernameValidation {
  valid: boolean
  error: string | null
}

const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 20
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/

const isLoading = ref(true)
const isSaving = ref(false)
const loadError = ref('')
const successMessage = ref('')
const errorMessage = ref('')

const userData = ref<UserProfile>({
  id: '',
  username: '',
  createdAt: ''
})

const originalUsername = ref('')

const form = ref({
  username: ''
})

const usernameValidation = ref<UsernameValidation>({
  valid: false,
  error: null
})

const formattedCreatedAt = computed(() => {
  if (!userData.value.createdAt) return ''
  const date = new Date(userData.value.createdAt)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const canSave = computed(() => {
  return (
    !isSaving.value &&
    form.value.username.trim() !== originalUsername.value &&
    form.value.username.trim() !== '' &&
    usernameValidation.value.valid
  )
})

const validateUsernameField = () => {
  const username = form.value.username
  const trimmed = username.trim()

  if (trimmed.length === 0) {
    usernameValidation.value = {
      valid: false,
      error: '用户名不能为空'
    }
    return
  }

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    usernameValidation.value = {
      valid: false,
      error: `用户名至少需要 ${USERNAME_MIN_LENGTH} 个字符`
    }
    return
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    usernameValidation.value = {
      valid: false,
      error: `用户名最多 ${USERNAME_MAX_LENGTH} 个字符`
    }
    return
  }

  if (!USERNAME_PATTERN.test(trimmed)) {
    usernameValidation.value = {
      valid: false,
      error: '用户名只能包含字母、数字和下划线'
    }
    return
  }

  usernameValidation.value = {
    valid: true,
    error: null
  }
}

const showMessage = (type: 'success' | 'error', message: string) => {
  if (type === 'success') {
    successMessage.value = message
    errorMessage.value = ''
  } else {
    errorMessage.value = message
    successMessage.value = ''
  }

  setTimeout(() => {
    if (type === 'success') {
      successMessage.value = ''
    } else {
      errorMessage.value = ''
    }
  }, 3000)
}

const clearMessages = () => {
  successMessage.value = ''
  errorMessage.value = ''
}

const fetchProfile = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const result = await $fetch('/api/user/profile', {
      headers: getAuthHeaders()
    })

    if (result && (result as { success: boolean }).success) {
      const data = (result as { success: boolean; data: UserProfile }).data
      userData.value = data
      form.value.username = data.username
      originalUsername.value = data.username
      usernameValidation.value = { valid: true, error: null }
    } else {
      loadError.value = (result as { success: boolean; error: string }).error || '获取用户资料失败'
    }
  } catch (error: unknown) {
    const fetchError = error as { data?: { error?: string } }
    loadError.value = fetchError.data?.error || '网络错误，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

const handleSave = async () => {
  if (!canSave.value) return

  validateUsernameField()
  if (!usernameValidation.value.valid) {
    return
  }

  clearMessages()
  isSaving.value = true

  try {
    const result = await $fetch('/api/user/profile', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: {
        username: form.value.username.trim()
      }
    })

    if (result && (result as { success: boolean }).success) {
      const data = (result as { success: boolean; data: UserProfile }).data
      
      originalUsername.value = data.username
      userData.value.username = data.username
      form.value.username = data.username
      
      if (user.value && token.value) {
        setAuth(token.value, {
          id: data.id,
          username: data.username,
          avatar: data.avatar,
          createdAt: data.createdAt
        })
      }

      usernameValidation.value = { valid: true, error: null }
      showMessage('success', '资料更新成功！')
    } else {
      const error = (result as { success: boolean; error: string }).error || '更新失败'
      showMessage('error', error)
    }
  } catch (error: unknown) {
    const fetchError = error as { data?: { error?: string }; response?: { status?: number } }
    
    if (fetchError.response?.status === 409) {
      showMessage('error', '用户名已存在，请尝试其他用户名')
    } else if (fetchError.response?.status === 400) {
      showMessage('error', fetchError.data?.error || '用户名格式不正确')
    } else {
      showMessage('error', fetchError.data?.error || '网络错误，请稍后重试')
    }
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  form.value.username = originalUsername.value
  usernameValidation.value = { valid: true, error: null }
  clearMessages()
}

const handleAvatarUploadSuccess = (avatar: string) => {
  showMessage('success', '头像上传成功！')
}

const handleAvatarUploadError = (error: string) => {
  showMessage('error', error)
}

const handleAvatarDeleteSuccess = () => {
  showMessage('success', '头像已删除')
}

onMounted(() => {
  fetchProfile()
})
</script>

<style scoped>
.profile-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.profile-card {
  background: white;
  border-radius: 16px;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.profile-card h1 {
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

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top-color: #00dc82;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-container p {
  margin-top: 1rem;
  color: #666;
}

.profile-form {
  width: 100%;
}

.avatar-section {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
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

.readonly-field {
  background: #f5f5f5;
  color: #666;
  cursor: not-allowed;
  border-color: #e0e0e0;
}

.input-error {
  border-color: #ff4757 !important;
}

.input-error:focus {
  box-shadow: 0 0 0 3px rgba(255, 71, 87, 0.1) !important;
}

.input-valid {
  border-color: #00dc82 !important;
}

.input-valid:focus {
  box-shadow: 0 0 0 3px rgba(0, 220, 130, 0.1) !important;
}

.hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
}

.error-hint {
  color: #ff4757;
}

.valid-hint {
  color: #00dc82;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.save-btn {
  flex: 1;
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

.save-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 220, 130, 0.4);
}

.save-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background: #ccc;
}

.cancel-btn {
  flex: 1;
  background: white;
  color: #666;
  border: 2px solid #e0e0e0;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover:not(:disabled) {
  border-color: #ff4757;
  color: #ff4757;
}

.cancel-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.success-message {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
  border-radius: 8px;
  padding: 0.875rem 1rem;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
  border-left: 4px solid #00dc82;
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

.additional-links {
  margin-top: 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.link {
  color: #00dc82;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
}

.link:hover {
  text-decoration: underline;
}

@media (max-width: 480px) {
  .profile-container {
    padding: 1rem;
  }

  .profile-card {
    padding: 1.5rem;
  }

  .action-buttons {
    flex-direction: column;
  }

  .save-btn,
  .cancel-btn {
    width: 100%;
  }
}
</style>
