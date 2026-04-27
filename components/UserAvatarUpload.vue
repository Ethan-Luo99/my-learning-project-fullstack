<template>
  <div class="avatar-upload-container">
    <div class="avatar-preview-section">
      <div class="avatar-wrapper" :class="{ 'avatar-editing': isEditing }">
        <div v-if="previewImage" class="avatar-preview-image">
          <img :src="previewImage" alt="Avatar Preview" class="avatar-img" />
        </div>
        <div v-else-if="currentAvatar" class="avatar-current">
          <img :src="currentAvatar" alt="Current Avatar" class="avatar-img" @error="handleAvatarError" />
        </div>
        <div v-else class="avatar-placeholder">
          <span class="placeholder-text">{{ getInitials }}</span>
        </div>
        
        <div class="avatar-overlay" @click="triggerFileInput">
          <span class="overlay-icon">📷</span>
          <span class="overlay-text">{{ isEditing ? '更换图片' : '上传头像' }}</span>
        </div>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        class="hidden-input"
        @change="handleFileSelect"
      />
    </div>

    <div v-if="isEditing" class="avatar-edit-section">
      <div v-if="previewImage" class="crop-section">
        <div class="crop-preview">
          <div
            class="crop-image-wrapper"
            ref="cropImageWrapper"
            @mousedown="startDrag"
            @touchstart="startDrag"
          >
            <img
              :src="previewImage"
              ref="cropImageRef"
              class="crop-image"
              :style="cropImageStyle"
              @load="onCropImageLoad"
            />
            <div class="crop-overlay">
              <div class="crop-frame"></div>
            </div>
          </div>
        </div>

        <div class="crop-controls">
          <div class="zoom-control">
            <label class="control-label">缩放</label>
            <div class="slider-container">
              <span class="slider-icon">−</span>
              <input
                type="range"
                v-model="zoomLevel"
                min="1"
                max="3"
                step="0.1"
                class="zoom-slider"
              />
              <span class="slider-icon">+</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="uploadProgress > 0" class="progress-section">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${uploadProgress}%` }"
          ></div>
        </div>
        <p class="progress-text">{{ uploadProgress }}% 上传中...</p>
      </div>

      <div class="action-buttons">
        <button
          type="button"
          class="btn-cancel"
          :disabled="isUploading"
          @click="handleCancel"
        >
          取消
        </button>
        <button
          v-if="currentAvatar"
          type="button"
          class="btn-delete"
          :disabled="isUploading"
          @click="handleDeleteAvatar"
        >
          删除头像
        </button>
        <button
          type="button"
          class="btn-confirm"
          :disabled="!previewImage || isUploading"
          @click="handleConfirm"
        >
          {{ isUploading ? '上传中...' : '确认上传' }}
        </button>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, getAuthHeaders, setAuth, token } = useAuth()

interface AvatarUploadResult {
  success: boolean
  data?: {
    avatar: string
    filename: string
    size: number
  }
  error?: string
  message?: string
}

const emit = defineEmits<{
  (e: 'upload-success', avatar: string): void
  (e: 'upload-error', error: string): void
  (e: 'delete-success'): void
}>()

const props = defineProps<{
  modelValue?: string | null
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const cropImageWrapper = ref<HTMLElement | null>(null)
const cropImageRef = ref<HTMLImageElement | null>(null)

const currentAvatar = computed(() => {
  if (props.modelValue !== undefined) {
    return props.modelValue
  }
  return user.value?.avatar || null
})

const getInitials = computed(() => {
  if (user.value?.username) {
    return user.value.username.charAt(0).toUpperCase()
  }
  return '?'
})

const previewImage = ref<string | null>(null)
const isEditing = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref('')
const successMessage = ref('')

const zoomLevel = ref(1)
const imagePosition = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const imageStart = ref({ x: 0, y: 0 })

const cropImageStyle = computed(() => ({
  transform: `translate(${imagePosition.value.x}px, ${imagePosition.value.y}px) scale(${zoomLevel.value})`,
  transformOrigin: 'center center'
}))

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    errorMessage.value = '不支持的文件类型。请上传 JPEG、PNG、GIF 或 WebP 格式的图片。'
    clearMessages()
    return
  }

  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    errorMessage.value = '文件大小超过限制。最大允许 5MB。'
    clearMessages()
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    previewImage.value = e.target?.result as string
    isEditing.value = true
    zoomLevel.value = 1
    imagePosition.value = { x: 0, y: 0 }
  }
  reader.readAsDataURL(file)
  
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const onCropImageLoad = () => {
  zoomLevel.value = 1
  imagePosition.value = { x: 0, y: 0 }
}

const startDrag = (event: MouseEvent | TouchEvent) => {
  isDragging.value = true
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  dragStart.value = { x: clientX, y: clientY }
  imageStart.value = { ...imagePosition.value }

  const handleMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging.value) return
    
    const moveX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const moveY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    imagePosition.value = {
      x: imageStart.value.x + (moveX - dragStart.value.x),
      y: imageStart.value.y + (moveY - dragStart.value.y)
    }
  }

  const handleEnd = () => {
    isDragging.value = false
    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('mouseup', handleEnd)
    window.removeEventListener('touchmove', handleMove)
    window.removeEventListener('touchend', handleEnd)
  }

  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleEnd)
  window.addEventListener('touchmove', handleMove)
  window.addEventListener('touchend', handleEnd)
}

const cropAndResizeImage = (): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (!previewImage.value) {
      reject(new Error('No image to crop'))
      return
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      const outputSize = 200
      canvas.width = outputSize
      canvas.height = outputSize

      const scale = zoomLevel.value
      const imgAspect = img.width / img.height
      const canvasAspect = 1

      let drawWidth: number
      let drawHeight: number
      let offsetX: number
      let offsetY: number

      if (imgAspect > canvasAspect) {
        drawHeight = outputSize
        drawWidth = outputSize * imgAspect
      } else {
        drawWidth = outputSize
        drawHeight = outputSize / imgAspect
      }

      offsetX = (outputSize - drawWidth * scale) / 2 + imagePosition.value.x
      offsetY = (outputSize - drawHeight * scale) / 2 + imagePosition.value.y

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, outputSize, outputSize)

      ctx.drawImage(
        img,
        offsetX,
        offsetY,
        drawWidth * scale,
        drawHeight * scale
      )

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob'))
          }
        },
        'image/jpeg',
        0.9
      )
    }
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    img.src = previewImage.value
  })
}

const handleConfirm = async () => {
  if (!previewImage.value || isUploading.value) return

  isUploading.value = true
  uploadProgress.value = 0
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const croppedBlob = await cropAndResizeImage()
    
    uploadProgress.value = 30

    const formData = new FormData()
    formData.append('avatar', croppedBlob, 'avatar.jpg')

    uploadProgress.value = 50

    const xhr = new XMLHttpRequest()
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 50)
        uploadProgress.value = 50 + percent
      }
    })

    const result = await new Promise<AvatarUploadResult>((resolve, reject) => {
      xhr.open('POST', '/api/user/avatar')
      
      const headers = getAuthHeaders()
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch {
            reject(new Error('Invalid response'))
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText)
            reject(new Error(errorData.error || 'Upload failed'))
          } catch {
            reject(new Error(`Upload failed with status: ${xhr.status}`))
          }
        }
      }

      xhr.onerror = () => {
        reject(new Error('Network error'))
      }

      xhr.send(formData)
    })

    uploadProgress.value = 100

    if (result.success && result.data) {
      successMessage.value = result.message || '头像上传成功！'
      
      if (user.value && token.value) {
        setAuth(token.value, {
          ...user.value,
          avatar: result.data.avatar
        })
      }
      
      emit('upload-success', result.data.avatar)
      
      setTimeout(() => {
        resetState()
      }, 1500)
    } else {
      throw new Error(result.error || '上传失败')
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    errorMessage.value = err.message || '上传失败，请稍后重试'
    emit('upload-error', errorMessage.value)
  } finally {
    isUploading.value = false
  }
}

const handleDeleteAvatar = async () => {
  if (isUploading.value) return

  const confirmed = window.confirm('确定要删除您的头像吗？此操作不可撤销。')
  if (!confirmed) return

  try {
    isUploading.value = true
    errorMessage.value = ''
    successMessage.value = ''

    const result = await $fetch('/api/user/avatar', {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (result && (result as { success: boolean }).success) {
      successMessage.value = '头像已删除'
      
      if (user.value && token.value) {
        setAuth(token.value, {
          ...user.value,
          avatar: null
        })
      }
      
      emit('delete-success')
      
      setTimeout(() => {
        resetState()
      }, 1500)
    } else {
      throw new Error((result as { error?: string }).error || '删除失败')
    }
  } catch (error: unknown) {
    const err = error as { data?: { error?: string } }
    errorMessage.value = err.data?.error || '删除失败，请稍后重试'
  } finally {
    isUploading.value = false
  }
}

const handleCancel = () => {
  resetState()
}

const resetState = () => {
  previewImage.value = null
  isEditing.value = false
  isUploading.value = false
  uploadProgress.value = 0
  errorMessage.value = ''
  successMessage.value = ''
  zoomLevel.value = 1
  imagePosition.value = { x: 0, y: 0 }
}

const handleAvatarError = () => {
  if (user.value && token.value) {
    setAuth(token.value, {
      ...user.value,
      avatar: null
    })
  }
}

const clearMessages = () => {
  setTimeout(() => {
    errorMessage.value = ''
    successMessage.value = ''
  }, 3000)
}
</script>

<style scoped>
.avatar-upload-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.avatar-preview-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 3px solid #e0e0e0;
  transition: all 0.3s ease;
}

.avatar-wrapper:hover {
  border-color: #00dc82;
  box-shadow: 0 0 0 4px rgba(0, 220, 130, 0.1);
}

.avatar-wrapper.avatar-editing {
  border-color: #00dc82;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.placeholder-text {
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 50%;
}

.avatar-wrapper:hover .avatar-overlay {
  opacity: 1;
}

.overlay-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.overlay-text {
  font-size: 0.75rem;
  color: white;
  font-weight: 500;
}

.hidden-input {
  display: none;
}

.avatar-edit-section {
  width: 100%;
  max-width: 350px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.crop-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.crop-preview {
  display: flex;
  justify-content: center;
}

.crop-image-wrapper {
  position: relative;
  width: 250px;
  height: 250px;
  overflow: hidden;
  border-radius: 8px;
  background: #f5f5f5;
  cursor: move;
}

.crop-image {
  max-width: none;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}

.crop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.crop-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 180px;
  height: 180px;
  border: 2px solid #00dc82;
  border-radius: 50%;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}

.crop-controls {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 8px;
}

.control-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #444;
  margin-bottom: 0.5rem;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.slider-icon {
  font-size: 1.25rem;
  color: #666;
  font-weight: 300;
  user-select: none;
}

.zoom-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #e0e0e0;
  border-radius: 3px;
  outline: none;
}

.zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #00dc82;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s;
}

.zoom-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.zoom-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #00dc82;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00dc82, #00c471);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-size: 0.875rem;
  color: #666;
  margin: 0;
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.action-buttons button {
  flex: 1;
  min-width: 80px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
  border: 2px solid #e0e0e0 !important;
}

.btn-cancel:hover:not(:disabled) {
  background: #e0e0e0;
  color: #444;
}

.btn-delete {
  background: #fff0f0;
  color: #ff4757;
  border: 2px solid #ffcccc !important;
}

.btn-delete:hover:not(:disabled) {
  background: #ff4757;
  color: white;
  border-color: #ff4757 !important;
}

.btn-confirm {
  background: linear-gradient(135deg, #00dc82 0%, #00c471 100%);
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 220, 130, 0.4);
}

.action-buttons button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.error-message {
  background: #fff0f0;
  color: #ff4757;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  border-left: 4px solid #ff4757;
}

.success-message {
  background: #d4edda;
  color: #155724;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  border-left: 4px solid #00dc82;
}
</style>
