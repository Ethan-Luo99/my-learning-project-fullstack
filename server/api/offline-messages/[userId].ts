import { getOfflineMessages, clearOfflineMessages, removeOfflineMessage, deliverOfflineMessages } from '~/server/utils/task-events';
import { verifyToken, extractTokenFromHeader } from '~/server/utils/jwt';

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
  const userId = getRouterParam(event, 'userId');

  if (!userId) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: 'User ID is required'
    };
  }

  const authenticatedUserId = getAuthenticatedUserId(event);
  if (!authenticatedUserId) {
    setResponseStatus(event, 401);
    return {
      success: false,
      error: 'Not authenticated'
    };
  }

  if (method === 'GET') {
    const messages = getOfflineMessages(userId);

    return {
      success: true,
      data: {
        userId,
        messageCount: messages.length,
        messages: messages.map(msg => ({
          id: msg.id,
          type: msg.type,
          data: msg.data,
          timestamp: msg.timestamp,
          retryCount: msg.retryCount
        }))
      }
    };
  }

  if (method === 'DELETE') {
    const query = getQuery(event);
    const messageId = query.messageId as string;

    if (messageId) {
      const removed = removeOfflineMessage(userId, messageId);
      if (removed) {
        return {
          success: true,
          message: `Message ${messageId} removed for user ${userId}`
        };
      } else {
        setResponseStatus(event, 404);
        return {
          success: false,
          error: 'Message not found'
        };
      }
    } else {
      clearOfflineMessages(userId);
      return {
        success: true,
        message: `All offline messages cleared for user ${userId}`
      };
    }
  }

  if (method === 'POST') {
    const query = getQuery(event);
    const action = query.action as string;

    if (action === 'deliver') {
      const delivered = deliverOfflineMessages(userId);
      return {
        success: true,
        data: {
          userId,
          deliveredCount: delivered.length,
          deliveredMessages: delivered.map(msg => ({
            id: msg.id,
            type: msg.type,
            data: msg.data,
            timestamp: msg.timestamp
          }))
        }
      };
    } else {
      setResponseStatus(event, 400);
      return {
        success: false,
        error: 'Invalid action. Use ?action=deliver to trigger delivery.'
      };
    }
  }

  setResponseStatus(event, 405);
  return {
    success: false,
    error: 'Method not allowed'
  };
});
