import { findUserById, comparePassword, hashPassword, updateUser } from '~/server/utils/userStorage';
import { verifyToken, extractTokenFromHeader } from '~/server/utils/jwt';
import { validatePassword } from '~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  if (method !== 'POST') {
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
    setResponseStatus(event, 404);
    return {
      success: false,
      error: 'User not found'
    };
  }

  const body = await readBody(event);

  if (!body.oldPassword || typeof body.oldPassword !== 'string') {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: 'Old password is required'
    };
  }

  if (!body.newPassword || typeof body.newPassword !== 'string') {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: 'New password is required'
    };
  }

  const passwordValid = await comparePassword(body.oldPassword, user.passwordHash);

  if (!passwordValid) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'Old password is incorrect'
    };
  }

  const newPasswordValidation = validatePassword(body.newPassword);
  if (!newPasswordValidation.valid) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: newPasswordValidation.error
    };
  }

  if (body.oldPassword === body.newPassword) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: 'New password must be different from old password'
    };
  }

  try {
    const newPasswordHash = await hashPassword(body.newPassword);

    const updatedUser = updateUser(user.id, {
      passwordHash: newPasswordHash
    });

    if (!updatedUser) {
      setResponseStatus(event, 500);
      return {
        success: false,
        error: 'Failed to update password'
      };
    }

    return {
      success: true,
      data: {
        message: 'Password updated successfully'
      }
    };
  } catch (error) {
    setResponseStatus(event, 500);
    return {
      success: false,
      error: 'Failed to update password'
    };
  }
});
