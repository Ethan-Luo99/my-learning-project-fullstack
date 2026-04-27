import { findUserById, findUserByUsername, updateUser } from '~/server/utils/userStorage';
import { verifyToken, extractTokenFromHeader } from '~/server/utils/jwt';
import { validateUsername } from '~/server/utils/validation';
import { getAvatarUrl } from '~/server/utils/avatarStorage';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

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
    setResponseStatus(event, 404);
    return {
      success: false,
      error: 'User not found'
    };
  }

  if (method === 'GET') {
    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        avatar: getAvatarUrl(user.avatar),
        createdAt: user.createdAt
      }
    };
  }

  if (method === 'PUT') {
    const body = await readBody(event);
    const { username } = body;

    const validation = validateUsername(username);
    if (!validation.valid) {
      setResponseStatus(event, 400);
      return {
        success: false,
        error: validation.error
      };
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername === user.username) {
      return {
        success: true,
        data: {
          id: user.id,
          username: user.username,
          avatar: getAvatarUrl(user.avatar),
          createdAt: user.createdAt
        }
      };
    }

    const existingUser = findUserByUsername(trimmedUsername);
    if (existingUser) {
      setResponseStatus(event, 409);
      return {
        success: false,
        error: 'Username already exists'
      };
    }

    const updatedUser = updateUser(user.id, {
      username: trimmedUsername
    });

    if (!updatedUser) {
      setResponseStatus(event, 500);
      return {
        success: false,
        error: 'Failed to update user profile'
      };
    }

    return {
      success: true,
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        avatar: getAvatarUrl(updatedUser.avatar),
        createdAt: updatedUser.createdAt
      }
    };
  }

  setResponseStatus(event, 405);
  return {
    success: false,
    error: 'Method not allowed'
  };
});
