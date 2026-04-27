import { createUser, findUserByUsername, type User } from '~/server/utils/userStorage';
import { generateToken } from '~/server/utils/jwt';
import { validateUsername, validatePassword } from '~/server/utils/validation';

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

  const validation = validateUsername(body.username);
  if (!validation.valid) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: validation.error
    };
  }

  const passwordValidation = validatePassword(body.password);
  if (!passwordValidation.valid) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: passwordValidation.error
    };
  }

  const username = body.username.trim();

  if (findUserByUsername(username)) {
    setResponseStatus(event, 409);
    return {
      success: false,
      error: 'Username already exists'
    };
  }

  try {
    const user = await createUser(username, body.password);
    const token = generateToken(user.id, user.username);

    setResponseStatus(event, 201);
    return {
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          createdAt: user.createdAt
        },
        token
      }
    };
  } catch (error) {
    setResponseStatus(event, 500);
    return {
      success: false,
      error: 'Failed to create user'
    };
  }
});
