import { findTaskWithUserById, updateTask, deleteTask, isTaskOwner, type TaskWithUser } from '~/server/utils/taskStorage';
import { getCurrentTimestamp } from '~/server/utils/userStorage';
import { verifyToken, extractTokenFromHeader } from '~/server/utils/jwt';
import { pushTaskUpdatedEvent, pushTaskDeletedEvent } from '~/server/utils/task-events';

function getAuthenticatedUserId(event: any): string | null {
  const authorization = getHeader(event, 'authorization');
  const token = extractTokenFromHeader(authorization);

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return payload.userId;
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const taskId = getRouterParam(event, 'id');

  const userId = getAuthenticatedUserId(event);
  if (!userId) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'Not authenticated'
    };
  }

  if (!taskId) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: 'Task ID is required'
    };
  }

  const task = findTaskWithUserById(taskId);

  if (!task) {
    setResponseStatus(event, 404);
    return {
      success: false,
      error: 'Task not found'
    };
  }

  if (!isTaskOwner(taskId, userId)) {
    setResponseStatus(event, 403);
    return {
      success: false,
      error: 'Access denied'
    };
  }

  if (method === 'GET') {
    return {
      success: true,
      data: task
    };
  }

  if (method === 'PUT') {
    const body = await readBody(event);

    const updates: {
      completed?: boolean;
      title?: string;
      description?: string;
    } = {};

    if (body.completed !== undefined) {
      if (typeof body.completed !== 'boolean') {
        setResponseStatus(event, 400);
        return {
          success: false,
          error: '"completed" must be a boolean'
        };
      }
      updates.completed = body.completed;
    }

    if (body.title !== undefined) {
      if (typeof body.title !== 'string') {
        setResponseStatus(event, 400);
        return {
          success: false,
          error: 'Title must be a string'
        };
      }
      const trimmedTitle = body.title.trim();
      if (trimmedTitle === '') {
        setResponseStatus(event, 400);
        return {
          success: false,
          error: 'Title cannot be empty or whitespace-only'
        };
      }
      updates.title = trimmedTitle;
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string') {
        setResponseStatus(event, 400);
        return {
          success: false,
          error: 'Description must be a string'
        };
      }
      updates.description = body.description.trim();
    }

    if (Object.keys(updates).length === 0) {
      setResponseStatus(event, 400);
      return {
        success: false,
        error: 'At least one field is required for update'
      };
    }

    const updatedTask = updateTask(taskId, updates);

    if (!updatedTask) {
      setResponseStatus(event, 404);
      return {
        success: false,
        error: 'Task not found'
      };
    }

    const taskWithUser = findTaskWithUserById(taskId);

    if (taskWithUser) {
      try {
        pushTaskUpdatedEvent(taskWithUser);
      } catch (error) {
        console.error('Failed to push task updated event:', error);
      }
    }

    return {
      success: true,
      data: taskWithUser
    };
  }

  if (method === 'DELETE') {
    const deletedTask = task;
    const isDeleted = deleteTask(taskId);

    if (!isDeleted) {
      setResponseStatus(event, 404);
      return {
        success: false,
        error: 'Task not found'
      };
    }

    try {
      pushTaskDeletedEvent(deletedTask);
    } catch (error) {
      console.error('Failed to push task deleted event:', error);
    }

    return {
      success: true,
      data: deletedTask
    };
  }

  setResponseStatus(event, 405);
  return {
    success: false,
    error: 'Method not allowed'
  };
});
