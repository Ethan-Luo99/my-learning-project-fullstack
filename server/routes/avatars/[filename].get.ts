import path from 'path';
import fs from 'fs';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars');

function getMimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const extToMime: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return extToMime[ext] || 'image/jpeg';
}

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename');
  
  if (!filename) {
    setResponseStatus(event, 400);
    return { error: 'Filename is required' };
  }
  
  const filepath = path.join(AVATAR_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    setResponseStatus(event, 404);
    return { error: 'Avatar not found' };
  }
  
  try {
    const buffer = fs.readFileSync(filepath);
    const mimeType = getMimeTypeFromFilename(filename);
    
    setResponseHeader(event, 'Content-Type', mimeType);
    setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000');
    
    return buffer;
  } catch (error) {
    setResponseStatus(event, 500);
    return { error: 'Failed to read avatar' };
  }
});
