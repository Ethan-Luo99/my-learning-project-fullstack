<template>
  <div class="tasks-container">
    <div class="header">
      <h1>任务管理</h1>
    </div>

    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div class="task-form">
      <h2>添加新任务</h2>
      <form @submit.prevent="addTask">
        <div class="form-group">
          <label for="title">任务标题</label>
          <input
            id="title"
            v-model="newTask.title"
            type="text"
            placeholder="输入任务标题..."
            required
          />
        </div>
        <div class="form-group">
          <label for="description">任务描述</label>
          <textarea
            id="description"
            v-model="newTask.description"
            placeholder="输入任务描述（可选）..."
            rows="3"
          ></textarea>
        </div>
        <button type="submit" :disabled="isAdding">
          {{ isAdding ? '添加中...' : '添加任务' }}
        </button>
      </form>
    </div>

    <div class="task-list">
      <h2>任务列表 ({{ tasks.length }})</h2>
      
      <div class="filter-section">
        <h3 class="filter-title">筛选与排序</h3>
        <div class="filter-controls">
          <div class="filter-group">
            <label class="filter-label">状态</label>
            <div class="status-buttons">
              <button
                type="button"
                class="status-btn"
                :class="{ active: filters.status === 'all' }"
                @click="filters.status = 'all'"
              >
                全部
              </button>
              <button
                type="button"
                class="status-btn"
                :class="{ active: filters.status === 'active' }"
                @click="filters.status = 'active'"
              >
                进行中
              </button>
              <button
                type="button"
                class="status-btn"
                :class="{ active: filters.status === 'completed' }"
                @click="filters.status = 'completed'"
              >
                已完成
              </button>
            </div>
          </div>
          
          <div class="filter-group">
            <label for="sort-by" class="filter-label">排序依据</label>
            <select
              id="sort-by"
              class="filter-select"
              v-model="filters.sortBy"
            >
              <option value="createdAt">创建时间</option>
              <option value="updatedAt">更新时间</option>
              <option value="title">标题</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label for="order" class="filter-label">排序顺序</label>
            <select
              id="order"
              class="filter-select"
              v-model="filters.order"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </div>
          
          <div class="filter-actions">
            <button type="button" class="apply-btn" @click="applyFilters">
              应用筛选
            </button>
            <button type="button" class="reset-btn" @click="resetFilters">
              重置
            </button>
          </div>
        </div>
      </div>
      
      <div v-if="tasks.length === 0" class="empty-state">
        <p>暂无任务，添加一个新任务开始吧！</p>
      </div>
      <div
        v-else
        class="tasks"
      >
        <div
          v-for="task in tasks"
          :key="task.id"
          class="task-item"
          :class="{ completed: task.completed, editing: editingTaskId === task.id }"
          @click="editingTaskId !== task.id && toggleTask(task)"
        >
          <div v-if="editingTaskId !== task.id" class="task-content">
            <h3 :class="{ 'task-title': true, completed: task.completed }">{{ task.title }}</h3>
            <p v-if="task.description" class="task-description">
              {{ task.description }}
            </p>
            <div class="task-meta">
              <span class="task-creator">
                创建者: <strong>{{ task.user.username }}</strong>
              </span>
              <span class="task-status">
                {{ task.completed ? '✓ 已完成' : '○ 进行中' }}
              </span>
              <span class="task-date">
                创建于: {{ formatDate(task.createdAt) }}
              </span>
            </div>
          </div>
          <div v-else class="edit-form">
            <div class="form-group">
              <label for="edit-title-{{ task.id }}" class="edit-label">任务标题</label>
              <input
                :id="'edit-title-' + task.id"
                v-model="editForm.title"
                type="text"
                class="edit-input"
                placeholder="输入任务标题..."
                ref="editTitleInput"
                @click.stop
              />
            </div>
            <div class="form-group">
              <label for="edit-description-{{ task.id }}" class="edit-label">任务描述</label>
              <textarea
                :id="'edit-description-' + task.id"
                v-model="editForm.description"
                class="edit-textarea"
                placeholder="输入任务描述（可选）..."
                rows="3"
                @click.stop
              ></textarea>
            </div>
            <div class="edit-actions">
              <button
                type="button"
                class="save-btn"
                @click.stop="saveEdit"
                :disabled="isSavingEdit"
              >
                {{ isSavingEdit ? '保存中...' : '保存' }}
              </button>
              <button
                type="button"
                class="cancel-btn"
                @click.stop="cancelEditing"
                :disabled="isSavingEdit"
              >
                取消
              </button>
            </div>
          </div>
          <div v-if="editingTaskId !== task.id" class="task-actions">
            <button
              type="button"
              class="edit-btn"
              @click.stop="startEditing(task)"
            >
              编辑
            </button>
            <button
              type="button"
              class="delete-btn"
              @click.stop="deleteTask(task.id)"
              :disabled="isDeleting === task.id"
            >
              {{ isDeleting === task.id ? '删除中...' : '删除' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

interface TaskUser {
  id: string
  username: string
}

interface Task {
  id: string
  userId: string
  title: string
  description: string
  completed: boolean
  createdAt: string
  updatedAt: string
  user: TaskUser
}

const { getAuthHeaders } = useAuth()

const tasks = ref<Task[]>([])
const isAdding = ref(false)
const isDeleting = ref<string>('')

const newTask = ref({
  title: '',
  description: ''
})

const editingTaskId = ref<string>('')
const editForm = ref({
  title: '',
  description: ''
})
const isSavingEdit = ref(false)
const editTitleInput = ref<HTMLInputElement | null>(null)

const filters = ref({
  status: 'all' as 'all' | 'active' | 'completed',
  sortBy: 'createdAt' as 'createdAt' | 'updatedAt' | 'title',
  order: 'desc' as 'asc' | 'desc'
})

const successMessage = ref('')
const errorMessage = ref('')

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

const fetchTasks = async () => {
  try {
    const queryParams: Record<string, string> = {}
    if (filters.value.status !== 'all') {
      queryParams.status = filters.value.status
    }
    queryParams.sortBy = filters.value.sortBy
    queryParams.order = filters.value.order

    const result = await $fetch('/api/tasks', {
      headers: getAuthHeaders(),
      query: queryParams
    })
    if (result && (result as { success: boolean; data: Task[] }).success) {
      tasks.value = (result as { success: boolean; data: Task[] }).data
    }
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
  }
}

onMounted(() => {
  fetchTasks()
})

const applyFilters = () => {
  fetchTasks()
}

const resetFilters = () => {
  filters.value = {
    status: 'all',
    sortBy: 'createdAt',
    order: 'desc'
  }
  fetchTasks()
}

const addTask = async () => {
  if (newTask.value.title.trim() === '') {
    return
  }

  isAdding.value = true

  try {
    const result = await $fetch('/api/tasks', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: {
        title: newTask.value.title,
        description: newTask.value.description
      }
    })

    if (result && (result as { success: boolean }).success) {
      newTask.value.title = ''
      newTask.value.description = ''
      await fetchTasks()
      showMessage('success', '任务添加成功！')
    }
  } catch (error: any) {
    console.error('Failed to add task:', error)
    const errorMsg = error.data?.error || '添加任务失败'
    showMessage('error', errorMsg)
  } finally {
    isAdding.value = false
  }
}

const toggleTask = async (task: Task) => {
  try {
    const result = await $fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: {
        completed: !task.completed
      }
    })

    if (result && (result as { success: boolean }).success) {
      await fetchTasks()
      const statusText = !task.completed ? '已完成' : '进行中'
      showMessage('success', `任务状态已更新为${statusText}！`)
    }
  } catch (error: any) {
    console.error('Failed to toggle task:', error)
    const errorMsg = error.data?.error || '更新任务状态失败'
    showMessage('error', errorMsg)
  }
}

const deleteTask = async (taskId: string) => {
  if (!confirm('确定要删除这个任务吗？')) {
    return
  }

  isDeleting.value = taskId

  try {
    const result = await $fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (result && (result as { success: boolean }).success) {
      await fetchTasks()
      showMessage('success', '任务删除成功！')
    }
  } catch (error: any) {
    console.error('Failed to delete task:', error)
    const errorMsg = error.data?.error || '删除任务失败'
    showMessage('error', errorMsg)
  } finally {
    isDeleting.value = ''
  }
}

const startEditing = (task: Task) => {
  editingTaskId.value = task.id
  editForm.value = {
    title: task.title,
    description: task.description
  }
  
  nextTick(() => {
    if (editTitleInput.value) {
      editTitleInput.value.focus()
    }
  })
}

const cancelEditing = () => {
  editingTaskId.value = ''
  editForm.value = {
    title: '',
    description: ''
  }
}

const saveEdit = async () => {
  if (editForm.value.title.trim() === '') {
    showMessage('error', '任务标题不能为空')
    return
  }

  isSavingEdit.value = true

  try {
    const result = await $fetch(`/api/tasks/${editingTaskId.value}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: {
        title: editForm.value.title,
        description: editForm.value.description
      }
    })

    if (result && (result as { success: boolean }).success) {
      cancelEditing()
      await fetchTasks()
      showMessage('success', '任务更新成功！')
    }
  } catch (error: any) {
    console.error('Failed to update task:', error)
    const errorMsg = error.data?.error || '更新任务失败'
    showMessage('error', errorMsg)
  } finally {
    isSavingEdit.value = false
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.tasks-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  min-height: 100vh;
}

.header {
  margin-bottom: 2rem;
  text-align: center;
}

.header h1 {
  font-size: 2.5rem;
  color: #00dc82;
  margin: 0;
}

.task-form {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.task-form h2 {
  font-size: 1.3rem;
  margin-bottom: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #00dc82;
}

.form-group textarea {
  resize: vertical;
}

.task-form button {
  background: #00dc82;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
  width: 100%;
}

.task-form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.task-form button:hover:not(:disabled) {
  background: #00c471;
}

.task-list {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.task-list h2 {
  font-size: 1.3rem;
  margin-bottom: 1.5rem;
  color: #333;
}

.filter-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.filter-title {
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  margin: 0 0 1rem 0;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #666;
}

.status-buttons {
  display: flex;
  gap: 0.5rem;
}

.status-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  color: #666;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.status-btn:hover {
  border-color: #00dc82;
  color: #00dc82;
}

.status-btn.active {
  background: #00dc82;
  color: white;
  border-color: #00dc82;
}

.filter-select {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.3s;
  min-width: 120px;
}

.filter-select:focus {
  outline: none;
  border-color: #00dc82;
}

.filter-actions {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}

.apply-btn {
  background: #00dc82;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
  font-weight: 500;
}

.apply-btn:hover {
  background: #00c471;
}

.reset-btn {
  background: #fff;
  color: #666;
  border: 1px solid #e0e0e0;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.reset-btn:hover {
  border-color: #00dc82;
  color: #00dc82;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #888;
}

.empty-state p {
  margin: 0;
}

.tasks {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.task-item:hover {
  border-color: #00dc82;
  box-shadow: 0 2px 8px rgba(0, 220, 130, 0.1);
}

.task-item.completed {
  background: #f8f8f8;
  border-color: #ddd;
}

.task-content {
  flex: 1;
  margin-right: 1rem;
}

.task-title {
  font-size: 1.1rem;
  margin: 0 0 0.5rem 0;
  color: #333;
  word-break: break-word;
}

.task-title.completed {
  text-decoration: line-through;
  color: #888;
}

.task-description {
  font-size: 0.95rem;
  color: #666;
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
  color: #888;
}

.task-creator {
  display: inline-flex;
  align-items: center;
}

.task-creator strong {
  color: #00dc82;
}

.task-status {
  font-weight: 500;
  color: #00dc82;
}

.task-item.completed .task-status {
  color: #888;
}

.delete-btn {
  background: #ff4757;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
  flex-shrink: 0;
}

.delete-btn:hover {
  background: #ff3838;
}

.delete-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.success-message {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.task-actions {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
}

.edit-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
  flex-shrink: 0;
}

.edit-btn:hover {
  background: #2980b9;
}

.task-item.editing {
  background: #f8f9fa;
  border-color: #3498db;
  cursor: default;
}

.edit-form {
  flex: 1;
  margin-right: 1rem;
}

.edit-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
  font-size: 0.9rem;
}

.edit-input,
.edit-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.edit-input:focus,
.edit-textarea:focus {
  outline: none;
  border-color: #3498db;
}

.edit-textarea {
  resize: vertical;
  min-height: 80px;
}

.edit-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.save-btn {
  background: #00dc82;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
  font-weight: 500;
}

.save-btn:hover:not(:disabled) {
  background: #00c471;
}

.save-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.cancel-btn {
  background: #fff;
  color: #666;
  border: 1px solid #e0e0e0;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.cancel-btn:hover:not(:disabled) {
  border-color: #ff4757;
  color: #ff4757;
}

.cancel-btn:disabled {
  background: #f5f5f5;
  color: #aaa;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .tasks-container {
    padding: 1rem;
  }

  .filter-controls {
    flex-direction: column;
    gap: 1rem;
  }

  .filter-group {
    width: 100%;
  }

  .status-buttons {
    flex-wrap: wrap;
  }

  .status-btn {
    flex: 1;
    min-width: auto;
    text-align: center;
  }

  .filter-select {
    width: 100%;
  }

  .filter-actions {
    width: 100%;
    flex-direction: row;
    align-items: center;
  }

  .apply-btn,
  .reset-btn {
    flex: 1;
    text-align: center;
    padding: 0.6rem 1rem;
  }

  .task-item {
    flex-direction: column;
    gap: 1rem;
  }

  .task-content {
    margin-right: 0;
  }

  .task-actions {
    width: 100%;
    flex-direction: column;
  }

  .edit-btn,
  .delete-btn {
    width: 100%;
  }

  .edit-form {
    margin-right: 0;
  }

  .edit-actions {
    width: 100%;
    flex-direction: column;
  }

  .save-btn,
  .cancel-btn {
    width: 100%;
  }
}
</style>
