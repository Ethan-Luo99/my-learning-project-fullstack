import type { WebSocketMessage, TaskEventData, WebSocketMessageType, TaskEventTask } from '~/server/utils/ws-events'

type TaskSnapshot = TaskEventTask

interface TaskEventHandlers {
  onTaskCreated?: (task: TaskSnapshot, message: WebSocketMessage<TaskEventData>) => void
  onTaskUpdated?: (task: TaskSnapshot, message: WebSocketMessage<TaskEventData>) => void
  onTaskDeleted?: (taskId: string, message: WebSocketMessage<TaskEventData>) => void
}

interface RealtimeTasksState {
  isListening: boolean
  lastEvent: {
    type: WebSocketMessageType
    data: TaskEventData
    timestamp: string
  } | null
}

const TASK_EVENT_TYPES: WebSocketMessageType[] = [
  'task_created',
  'task_updated',
  'task_deleted'
]

export const useRealtimeTasks = () => {
  const ws = useWebSocket()
  
  const state = ref<RealtimeTasksState>({
    isListening: false,
    lastEvent: null
  })

  const isListening = computed(() => state.value.isListening)
  const lastEvent = computed(() => state.value.lastEvent)

  let unsubscribers: (() => void)[] = []

  const handleTaskEvent = (
    message: WebSocketMessage<TaskEventData>,
    handlers: TaskEventHandlers
  ) => {
    const { type, data } = message
    
    state.value.lastEvent = {
      type,
      data,
      timestamp: message.timestamp
    }

    switch (type) {
      case 'task_created':
        if (data.task && handlers.onTaskCreated) {
          handlers.onTaskCreated(data.task, message)
        }
        break
      case 'task_updated':
        if (data.task && handlers.onTaskUpdated) {
          handlers.onTaskUpdated(data.task, message)
        }
        break
      case 'task_deleted':
        if (handlers.onTaskDeleted) {
          handlers.onTaskDeleted(data.taskId, message)
        }
        break
    }
  }

  const startListening = (handlers: TaskEventHandlers): (() => void) => {
    if (state.value.isListening) {
      console.warn('Realtime tasks already listening, stopping previous listeners')
      stopListening()
    }

    state.value.isListening = true

    TASK_EVENT_TYPES.forEach((eventType) => {
      const unsub = ws.on<TaskEventData>(eventType, (message) => {
        handleTaskEvent(message, handlers)
      })
      unsubscribers.push(unsub)
    })

    console.log('Started listening for task events')

    return stopListening
  }

  const stopListening = () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub()
      } catch (e) {
        console.error('Error unsubscribing from task event:', e)
      }
    })
    unsubscribers = []
    state.value.isListening = false
    console.log('Stopped listening for task events')
  }

  const useTaskEvents = (handlers: TaskEventHandlers) => {
    onMounted(() => {
      startListening(handlers)
    })

    onUnmounted(() => {
      stopListening()
    })

    return {
      isListening,
      lastEvent,
      stopListening
    }
  }

  return {
    isListening,
    lastEvent,
    startListening,
    stopListening,
    useTaskEvents
  }
}

export type { TaskSnapshot, TaskEventHandlers }
