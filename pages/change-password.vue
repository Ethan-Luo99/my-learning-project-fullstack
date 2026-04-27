<template>
  <div class="change-password-container">
    <div class="change-password-card">
      <h1>修改密码</h1>
      <p class="subtitle">为您的账户设置新密码</p>

      <form @submit.prevent="handleSubmit">
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="success-message">
          {{ successMessage }}
        </div>

        <div class="form-group">
          <label for="oldPassword">旧密码</label>
          <div class="password-input-wrapper">
            <input
              id="oldPassword"
              v-model="form.oldPassword"
              :type="showOldPassword ? 'text' : 'password'"
              placeholder="请输入当前密码"
              :disabled="isSubmitting"
              :class="{
                'input-error': oldPasswordError && form.oldPassword !== ''
              }"
              @input="validateOldPasswordField"
            />
            <button
              type="button"
              class="toggle-password-btn"
              @click="toggleShowOldPassword"
              :disabled="isSubmitting"
            >
              {{ showOldPassword ? '隐藏' : '显示' }}
            </button>
          </div>
          <p v-if="oldPasswordError" class="hint error-hint">
            {{ oldPasswordError }}
          </p>
        </div>

        <div class="form-group">
          <label for="newPassword">新密码</label>
          <div class="password-input-wrapper">
            <input
              id="newPassword"
              v-model="form.newPassword"
              :type="showNewPassword ? 'text' : 'password'"
              placeholder="请输入新密码"
              :disabled="isSubmitting"
              :class="{
                'input-error': newPasswordError && form.newPassword !== '',
                'input-valid': newPasswordValid && form.newPassword !== ''
              }"
              @input="validateNewPasswordField"
            />
            <button
              type="button"
              class="toggle-password-btn"
              @click="toggleShowNewPassword"
              :disabled="isSubmitting"
            >
              {{ showNewPassword ? '隐藏' : '显示' }}
            </button>
          </div>

          <div v-if="form.newPassword !== ''" class="password-strength-section">
            <div class="strength-indicator">
              <span class="strength-label">密码强度:</span>
              <span :class="['strength-value', strengthClass]">
                {{ strengthLabel }}
              </span>
            </div>
            <div class="strength-bar">
              <div
                v-for="i in 4"
                :key="i"
                :class="['strength-bar-segment', getBarSegmentClass(i)]"
              ></div>
            </div>
            <div v-if="strengthSuggestions.length > 0" class="strength-suggestions">
              <p v-for="(suggestion, index) in strengthSuggestions" :key="index" class="suggestion">
                {{ suggestion }}
              </p>
            </div>
          </div>

          <div v-if="form.newPassword !== ''" class="password-requirements">
            <p class="requirements-title">密码要求:</p>
            <ul class="requirements-list">
              <li :class="['requirement-item', { 'meets': hasMinLength }]">
                <span class="checkmark">{{ hasMinLength ? '✓' : '○' }}</span>
                至少 6 个字符
              </li>
              <li :class="['requirement-item', { 'meets': hasMaxLength }]">
                <span class="checkmark">{{ hasMaxLength ? '✓' : '○' }}</span>
                最多 100 个字符
              </li>
              <li :class="['requirement-item', { 'meets': hasLetter }]">
                <span class="checkmark">{{ hasLetter ? '✓' : '○' }}</span>
                至少包含一个字母
              </li>
              <li :class="['requirement-item', { 'meets': hasNumber }]">
                <span class="checkmark">{{ hasNumber ? '✓' : '○' }}</span>
                至少包含一个数字
              </li>
            </ul>
          </div>

          <p v-if="newPasswordError" class="hint error-hint">
            {{ newPasswordError }}
          </p>
          <p v-else-if="newPasswordValid && form.newPassword !== ''" class="hint valid-hint">
            密码格式正确
          </p>
        </div>

        <div class="form-group">
          <label for="confirmPassword">确认新密码</label>
          <div class="password-input-wrapper">
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="请再次输入新密码"
              :disabled="isSubmitting"
              :class="{
                'input-error': confirmPasswordError && form.confirmPassword !== '',
                'input-valid': confirmPasswordValid && form.confirmPassword !== ''
              }"
              @input="validateConfirmPasswordField"
            />
            <button
              type="button"
              class="toggle-password-btn"
              @click="toggleShowConfirmPassword"
              :disabled="isSubmitting"
            >
              {{ showConfirmPassword ? '隐藏' : '显示' }}
            </button>
          </div>
          <p v-if="confirmPasswordError" class="hint error-hint">
            {{ confirmPasswordError }}
          </p>
          <p v-else-if="confirmPasswordValid && form.confirmPassword !== ''" class="hint valid-hint">
            两次密码一致
          </p>
        </div>

        <div v-if="samePasswordError" class="error-message">
          {{ samePasswordError }}
        </div>

        <div class="action-buttons">
          <button
            type="submit"
            :disabled="!canSubmit || isSubmitting"
            class="submit-btn"
          >
            {{ isSubmitting ? '修改中...' : '确认修改' }}
          </button>
          <button
            type="button"
            :disabled="isSubmitting"
            @click="handleCancel"
            class="cancel-btn"
          >
            取消
          </button>
        </div>

        <div class="additional-links">
          <NuxtLink to="/profile" class="link">返回个人资料</NuxtLink>
          <NuxtLink to="/" class="link">返回首页</NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const { getAuthHeaders, clearAuth } = useAuth()
const router = useRouter()

const PASSWORD_MIN_LENGTH = 6
const PASSWORD_MAX_LENGTH = 100
const PASSWORD_HAS_LETTER = /[a-zA-Z]/
const PASSWORD_HAS_NUMBER = /[0-9]/
const PASSWORD_HAS_UPPERCASE = /[A-Z]/
const PASSWORD_HAS_LOWERCASE = /[a-z]/
const PASSWORD_HAS_SPECIAL = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/

type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'strong'

interface PasswordStrengthResult {
  level: PasswordStrengthLevel
  meetsRequirements: boolean
  suggestions: string[]
}

const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const redirectTimer = ref<number | null>(null)

const showOldPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const form = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const oldPasswordError = ref('')
const newPasswordError = ref('')
const confirmPasswordError = ref('')
const samePasswordError = ref('')

const newPasswordValid = ref(false)
const confirmPasswordValid = ref(false)

const hasMinLength = computed(() => form.value.newPassword.length >= PASSWORD_MIN_LENGTH)
const hasMaxLength = computed(() => form.value.newPassword.length <= PASSWORD_MAX_LENGTH)
const hasLetter = computed(() => PASSWORD_HAS_LETTER.test(form.value.newPassword))
const hasNumber = computed(() => PASSWORD_HAS_NUMBER.test(form.value.newPassword))

const checkPasswordStrength = (password: string): PasswordStrengthResult => {
  const suggestions: string[] = []
  
  const meetsRequirements = (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    PASSWORD_HAS_LETTER.test(password) &&
    PASSWORD_HAS_NUMBER.test(password)
  )

  let lengthScore = 0
  let diversityScore = 0

  if (password.length >= PASSWORD_MIN_LENGTH) {
    if (password.length >= 8) lengthScore += 1
    if (password.length >= 12) lengthScore += 1
    if (password.length >= 16) lengthScore += 1
  }

  const hasLowercase = PASSWORD_HAS_LOWERCASE.test(password)
  const hasUppercase = PASSWORD_HAS_UPPERCASE.test(password)
  const hasSpecial = PASSWORD_HAS_SPECIAL.test(password)

  if (hasLowercase) diversityScore += 1
  if (hasUppercase) diversityScore += 1
  if (PASSWORD_HAS_NUMBER.test(password)) diversityScore += 1
  if (hasSpecial) diversityScore += 1

  if (!hasLowercase && !hasUppercase) {
    suggestions.push('添加字母以增强密码强度')
  }
  if (!hasUppercase) {
    suggestions.push('添加大写字母以增强密码强度')
  }
  if (!hasSpecial) {
    suggestions.push('添加特殊字符（如 !@#$%^&*）以增强密码强度')
  }
  if (password.length < 8) {
    suggestions.push('使用至少8个字符的密码更安全')
  }
  if (password.length < 12 && meetsRequirements) {
    suggestions.push('使用12个或更多字符可获得更好的安全性')
  }

  const totalScore = lengthScore + diversityScore

  let level: PasswordStrengthLevel = 'weak'
  if (totalScore >= 7) {
    level = 'strong'
  } else if (totalScore >= 5) {
    level = 'good'
  } else if (totalScore >= 3) {
    level = 'fair'
  }

  if (level === 'strong') {
    suggestions.length = 0
    suggestions.push('密码强度很好！继续保持')
  } else if (level === 'good') {
    if (suggestions.length === 0) {
      suggestions.push('可以通过增加长度或添加特殊字符来进一步增强密码')
    }
  }

  return {
    level,
    meetsRequirements,
    suggestions
  }
}

const strengthResult = computed(() => {
  if (form.value.newPassword === '') {
    return null
  }
  return checkPasswordStrength(form.value.newPassword)
})

const strengthLabel = computed(() => {
  if (!strengthResult.value) return '弱'
  switch (strengthResult.value.level) {
    case 'weak': return '弱'
    case 'fair': return '中'
    case 'good': return '强'
    case 'strong': return '非常强'
    default: return '弱'
  }
})

const strengthClass = computed(() => {
  if (!strengthResult.value) return 'weak'
  return strengthResult.value.level
})

const strengthSuggestions = computed(() => {
  return strengthResult.value?.suggestions || []
})

const getBarSegmentClass = (index: number) => {
  if (!strengthResult.value) return 'empty'
  
  let filledCount = 0
  switch (strengthResult.value.level) {
    case 'weak': filledCount = 1; break
    case 'fair': filledCount = 2; break
    case 'good': filledCount = 3; break
    case 'strong': filledCount = 4; break
  }
  
  if (index <= filledCount) {
    return `filled-${strengthResult.value.level}`
  }
  return 'empty'
}

const toggleShowOldPassword = () => {
  showOldPassword.value = !showOldPassword.value
}

const toggleShowNewPassword = () => {
  showNewPassword.value = !showNewPassword.value
}

const toggleShowConfirmPassword = () => {
  showConfirmPassword.value = !showConfirmPassword.value
}

const validateOldPasswordField = () => {
  if (form.value.oldPassword === '') {
    oldPasswordError.value = '请输入旧密码'
  } else {
    oldPasswordError.value = ''
  }
}

const validateNewPasswordField = () => {
  const password = form.value.newPassword
  
  if (password === '') {
    newPasswordError.value = '请输入新密码'
    newPasswordValid.value = false
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    newPasswordError.value = `密码至少需要 ${PASSWORD_MIN_LENGTH} 个字符`
    newPasswordValid.value = false
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    newPasswordError.value = `密码最多 ${PASSWORD_MAX_LENGTH} 个字符`
    newPasswordValid.value = false
  } else if (!PASSWORD_HAS_LETTER.test(password)) {
    newPasswordError.value = '密码必须包含至少一个字母'
    newPasswordValid.value = false
  } else if (!PASSWORD_HAS_NUMBER.test(password)) {
    newPasswordError.value = '密码必须包含至少一个数字'
    newPasswordValid.value = false
  } else {
    newPasswordError.value = ''
    newPasswordValid.value = true
  }

  validateConfirmPasswordField()
  checkSamePassword()
}

const validateConfirmPasswordField = () => {
  const confirm = form.value.confirmPassword
  const newPassword = form.value.newPassword
  
  if (confirm === '') {
    confirmPasswordError.value = '请确认新密码'
    confirmPasswordValid.value = false
  } else if (confirm !== newPassword) {
    confirmPasswordError.value = '两次输入的密码不一致'
    confirmPasswordValid.value = false
  } else {
    confirmPasswordError.value = ''
    confirmPasswordValid.value = true
  }

  checkSamePassword()
}

const checkSamePassword = () => {
  if (form.value.oldPassword !== '' && 
      form.value.newPassword !== '' && 
      form.value.oldPassword === form.value.newPassword) {
    samePasswordError.value = '新密码不能与旧密码相同'
  } else {
    samePasswordError.value = ''
  }
}

const canSubmit = computed(() => {
  return (
    form.value.oldPassword !== '' &&
    newPasswordValid.value &&
    confirmPasswordValid.value &&
    samePasswordError.value === ''
  )
})

const clearMessages = () => {
  errorMessage.value = ''
  successMessage.value = ''
}

const handleSubmit = async () => {
  if (!canSubmit.value || isSubmitting.value) return

  validateOldPasswordField()
  validateNewPasswordField()
  validateConfirmPasswordField()
  checkSamePassword()

  if (!canSubmit.value) return

  clearMessages()
  isSubmitting.value = true

  try {
    const result = await $fetch('/api/user/change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: {
        oldPassword: form.value.oldPassword,
        newPassword: form.value.newPassword
      }
    })

    if (result && (result as { success: boolean }).success) {
      successMessage.value = '密码修改成功！3秒后自动跳转到登录页...'
      
      redirectTimer.value = window.setTimeout(async () => {
        await clearAuth()
        router.push('/login')
      }, 3000)
    } else {
      const error = (result as { success: boolean; error: string }).error || '修改失败'
      if (error.includes('Old password')) {
        errorMessage.value = '旧密码不正确'
      } else if (error.includes('New password must be different')) {
        errorMessage.value = '新密码不能与旧密码相同'
      } else {
        errorMessage.value = error
      }
    }
  } catch (error: unknown) {
    const fetchError = error as { data?: { error?: string }; response?: { status?: number } }
    
    if (fetchError.response?.status === 401) {
      errorMessage.value = '旧密码不正确'
    } else if (fetchError.response?.status === 400) {
      if (fetchError.data?.error?.includes('New password must be different')) {
        errorMessage.value = '新密码不能与旧密码相同'
      } else {
        errorMessage.value = fetchError.data?.error || '密码格式不正确'
      }
    } else {
      errorMessage.value = fetchError.data?.error || '网络错误，请稍后重试'
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleCancel = () => {
  if (redirectTimer.value) {
    clearTimeout(redirectTimer.value)
    redirectTimer.value = null
  }
  router.push('/profile')
}

onUnmounted(() => {
  if (redirectTimer.value) {
    clearTimeout(redirectTimer.value)
  }
})
</script>

<style scoped>
.change-password-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.change-password-card {
  background: white;
  border-radius: 16px;
  padding: 2.5rem;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.change-password-card h1 {
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

.password-input-wrapper {
  position: relative;
}

.password-input-wrapper input {
  width: 100%;
  padding: 0.875rem 6rem 0.875rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.password-input-wrapper input:focus {
  outline: none;
  border-color: #00dc82;
  box-shadow: 0 0 0 3px rgba(0, 220, 130, 0.1);
}

.password-input-wrapper input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.toggle-password-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #00dc82;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.toggle-password-btn:hover:not(:disabled) {
  background-color: rgba(0, 220, 130, 0.1);
}

.toggle-password-btn:disabled {
  color: #ccc;
  cursor: not-allowed;
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

.password-strength-section {
  margin-top: 0.75rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.strength-indicator {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
}

.strength-label {
  font-size: 0.875rem;
  color: #666;
  margin-right: 0.5rem;
}

.strength-value {
  font-weight: 600;
  font-size: 0.875rem;
}

.strength-value.weak {
  color: #ff4757;
}

.strength-value.fair {
  color: #ffa502;
}

.strength-value.good {
  color: #2ed573;
}

.strength-value.strong {
  color: #009432;
}

.strength-bar {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.strength-bar-segment {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background-color: #e0e0e0;
  transition: background-color 0.3s;
}

.strength-bar-segment.empty {
  background-color: #e0e0e0;
}

.strength-bar-segment.filled-weak {
  background-color: #ff4757;
}

.strength-bar-segment.filled-fair {
  background-color: #ffa502;
}

.strength-bar-segment.filled-good {
  background-color: #2ed573;
}

.strength-bar-segment.filled-strong {
  background-color: #009432;
}

.strength-suggestions {
  margin-top: 0.5rem;
}

.suggestion {
  margin: 0.25rem 0;
  font-size: 0.8rem;
  color: #666;
}

.password-requirements {
  margin-top: 0.75rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.requirements-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #444;
}

.requirements-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.requirement-item {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  color: #888;
  transition: color 0.3s;
}

.requirement-item.meets {
  color: #00dc82;
}

.checkmark {
  margin-right: 0.5rem;
  font-weight: 600;
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

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.submit-btn {
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

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 220, 130, 0.4);
}

.submit-btn:disabled {
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
  .change-password-container {
    padding: 1rem;
  }

  .change-password-card {
    padding: 1.5rem;
  }

  .requirements-list {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
  }

  .submit-btn,
  .cancel-btn {
    width: 100%;
  }
}
</style>
