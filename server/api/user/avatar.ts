import { findUserById, updateUser } from '~/server/utils/userStorage';
import { verifyToken, extractTokenFromHeader } from '~/server/utils/jwt';
import { 
  validateAvatar, 
  generateAvatarFilename, 
  saveAvatar, 
  deleteAvatar, 
  getAvatarUrl
} from '~/server/utils/avatarStorage';

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
        avatar: getAvatarUrl(user.avatar)
      }
    };
  }

  if (method === 'POST') {
    const formData = await readMultipartFormData(event);
    
    if (!formData) {
      setResponseStatus(event, 400);
      return {
        success: false,
        error: 'No file uploaded'
      };
    }

    const avatarField = formData.find(field => field.name === 'avatar');
    
    if (!avatarField || !avatarField.data) {
      setResponseStatus(event, 400);
      return {
        success: false,
        error: 'Avatar field is required'
      };
    }

    const mimeType = avatarField.type || 'application/octet-stream';
    const validation = validateAvatar(avatarField.data, mimeType);
    
    if (!validation.valid) {
      setResponseStatus(event, 400);
      return {
        success: false,
        error: validation.error
      };
    }

    if (user.avatar) {
      deleteAvatar(user.avatar);
    }

    const filename = generateAvatarFilename(user.id, mimeType);
    const avatarInfo = saveAvatar(avatarField.data, filename);

    const updatedUser = updateUser(user.id, {
      avatar: filename
    });

    if (!updatedUser) {
      deleteAvatar(filename);
      setResponseStatus(event, 500);
      return {
        success: false,
        error: 'Failed to update user avatar'
      };
    }

    return {
      success: true,
      data: {
        avatar: avatarInfo.url,
        filename: avatarInfo.filename,
        size: avatarInfo.size
      },
      message: 'Avatar uploaded successfully'
    };
  }

  if (method === 'DELETE') {
    if (!user.avatar) {
      return {
        success: true,
        message: 'No avatar to delete'
      };
    }

    const filename = user.avatar;
    deleteAvatar(filename);

    const updatedUser = updateUser(user.id, {
      avatar: null
    });

    if (!updatedUser) {
      setResponseStatus(event, 500);
      return {
        success: false,
        error: 'Failed to remove avatar'
      };
    }

    return {
      success: true,
      message: 'Avatar deleted successfully'
    };
  }

  setResponseStatus(event, 405);
  return {
    success: false,
    error: 'Method not allowed'
  };
});
