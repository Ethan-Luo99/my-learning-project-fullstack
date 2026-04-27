export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  if (method !== 'POST') {
    setResponseStatus(event, 405);
    return {
      success: false,
      error: 'Method not allowed'
    };
  }

  return {
    success: true,
    data: {
      message: 'Logged out successfully. Please clear your authentication token.'
    }
  };
});
