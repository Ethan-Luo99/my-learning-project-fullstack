import { readTasksWithUsersByUserId, createTask, type TaskWithUser, type Task, type TaskQueryOptions } from '~/server/utils/taskStorage';
import { verifyToken, extractTokenFromHeader } from '~/server/utils/jwt';
import { generateId, getCurrentTimestamp } from '~/server/utils/userStorage';

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

function validateQueryParams(query: any): TaskQueryOptions {
  const options: TaskQueryOptions = {};

  // 验证 status 参数
  const validStatuses = ['all', 'active', 'completed'];
  const status = typeof query.status === 'string' ? query.status : 'all';
  if (validStatuses.includes(status)) {
    options.status = status as TaskQueryOptions['status'];
  }

  // 验证 sortBy 参数
  const validSortFields = ['createdAt', 'updatedAt', 'title', 'priority'];
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'createdAt';
  if (validSortFields.includes(sortBy)) {
    options.sortBy = sortBy as TaskQueryOptions['sortBy'];
  }

  // 验证 order 参数
  const validOrders = ['asc', 'desc'];
  const order = typeof query.order === 'string' ? query.order : 'desc';
  if (validOrders.includes(order)) {
    options.order = order as TaskQueryOptions['order'];
  }

  return options;
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  const userId = getAuthenticatedUserId(event);
  if (!userId) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'Not authenticated'
    };
  }

  if (method === 'GET') {
    const query = getQuery(event);
    const options = validateQueryParams(query);
    const tasks = readTasksWithUsersByUserId(userId, options);
    return {
      success: true,
      data: tasks
    };
  }

  if (method === 'POST') {
    const body = await readBody(event);

    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      setResponseStatus(event, 400);
      return {
        success: false,
        error: 'Title is required and must be a non-empty string'
      };
    }

    if (body.description !== undefined && typeof body.description !== 'string') {
      setResponseStatus(event, 400);
      return {
        success: false,
        error: 'Description must be a string'
      };
    }

    const newTask = createTask(
      userId,
      body.title.trim(),
      body.description ? body.description.trim() : ''
    );

    setResponseStatus(event, 201);
    return {
      success: true,
      data: newTask
    };
  }

  setResponseStatus(event, 405);
  return {
    success: false,
    error: 'Method not allowed'
  };
});
