import { findUserById } from '~/server/utils/userStorage';
import { verifyToken, extractTokenFromHeader } from '~/server/utils/jwt';
import { getAvatarUrl } from '~/server/utils/avatarStorage';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  if (method !== 'GET') {
    setResponseStatus(event, 405);
    return {
      success: false,
      error: 'Method not allowed'
    };
  }

  const authorization = getHeader(event, 'authorization');
  const token = extractTokenFromHeader(authorization);

  if (!token) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'Not authenticated'
    };
  }

  const payload = verifyToken(token);

  if (!payload) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'Invalid or expired token'
    };
  }

  const user = findUserById(payload.userId);

  if (!user) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'User not found'
    };
  }

  return {
    success: true,
    data: {
      id: user.id,
      username: user.username,
      avatar: getAvatarUrl(user.avatar),
      createdAt: user.createdAt
    }
  };
});
