import { findUserByUsername, comparePassword, type User } from '~/server/utils/userStorage';
import { generateToken } from '~/server/utils/jwt';
import { getAvatarUrl } from '~/server/utils/avatarStorage';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  if (method !== 'POST') {
    setResponseStatus(event, 405);
    return {
      success: false,
      error: 'Method not allowed'
    };
  }

  const body = await readBody(event);

  if (!body.username || typeof body.username !== 'string' || body.username.trim() === '') {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: 'Username is required'
    };
  }

  if (!body.password || typeof body.password !== 'string') {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: 'Password is required'
    };
  }

  const username = body.username.trim();
  const user = findUserByUsername(username);

  if (!user) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'Invalid username or password'
    };
  }

  const passwordValid = await comparePassword(body.password, user.passwordHash);

  if (!passwordValid) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'Invalid username or password'
    };
  }

  const token = generateToken(user.id, user.username);

  return {
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        avatar: getAvatarUrl(user.avatar),
        createdAt: user.createdAt
      },
      token
    }
  };
});
