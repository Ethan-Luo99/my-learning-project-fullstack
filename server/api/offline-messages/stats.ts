import { getOfflineMessageStats } from '~/server/utils/task-events';
import { verifyToken, extractTokenFromHeader } from '~/server/utils/jwt';

function isAuthenticated(event: any): boolean {
  const authorization = getHeader(event, 'authorization');
  const token = extractTokenFromHeader(authorization);

  if (!token) {
    return false;
  }

  const payload = verifyToken(token);
  return !!payload;
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  if (method !== 'GET') {
    setResponseStatus(event, 405);
    return {
      success: false,
      error: 'Method not allowed'
    };
  }

  if (!isAuthenticated(event)) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'Not authenticated'
    };
  }

  const stats = getOfflineMessageStats();

  return {
    success: true,
    data: {
      totalUsers: stats.totalUsers,
      totalMessages: stats.totalMessages,
      usersWithMessages: stats.usersWithMessages,
      timestamp: new Date().toISOString()
    }
  };
});
