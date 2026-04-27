import path from 'path';
import fs from 'fs';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars');
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface AvatarInfo {
  filename: string;
  filepath: string;
  url: string;
  size: number;
  mimeType: string;
}

function ensureAvatarDir(): void {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }
}

export function validateAvatar(buffer: Buffer, mimeType: string): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `不支持的文件类型。允许的类型: ${ALLOWED_MIME_TYPES.join(', ')}`
    };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件大小超过限制。最大允许: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  return { valid: true };
}

export function generateAvatarFilename(userId: string, mimeType: string): string {
  const ext = getExtensionFromMimeType(mimeType);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  
  return `avatar-${userId}-${timestamp}-${random}${ext}`;
}

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp'
  };
  return mimeToExt[mimeType] || '.jpg';
}

export function saveAvatar(buffer: Buffer, filename: string): AvatarInfo {
  ensureAvatarDir();
  
  const filepath = path.join(AVATAR_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  
  const stats = fs.statSync(filepath);
  
  return {
    filename,
    filepath,
    url: `/avatars/${filename}`,
    size: stats.size,
    mimeType: getMimeTypeFromFilename(filename)
  };
}

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

export function deleteAvatar(filename: string): boolean {
  const filepath = path.join(AVATAR_DIR, filename);
  
  if (fs.existsSync(filepath)) {
    try {
      fs.unlinkSync(filepath);
      return true;
    } catch {
      return false;
    }
  }
  
  return false;
}

export function getAvatarUrl(filename: string | null): string | null {
  if (!filename) return null;
  return `/avatars/${filename}`;
}

export function extractFilenameFromUrl(url: string): string | null {
  const match = url.match(/^\/avatars\/(.+)$/);
  return match ? match[1] : null;
}
