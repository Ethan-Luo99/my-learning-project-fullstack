import { createHmac, timingSafeEqual } from 'crypto';

export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key-change-in-production';
const JWT_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  let padded = str;
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  padded = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(header: object, payload: object, secret: string): string {
  const headerStr = base64UrlEncode(JSON.stringify(header));
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  
  const signatureInput = `${headerStr}.${payloadStr}`;
  const signature = createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${signatureInput}.${signature}`;
}

function verifySignature(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  
  const [headerStr, payloadStr, signatureStr] = parts;
  const signatureInput = `${headerStr}.${payloadStr}`;
  
  const expectedSignature = createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return timingSafeEqual(
    Buffer.from(signatureStr),
    Buffer.from(expectedSignature)
  );
}

export function generateToken(userId: string, username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + Math.floor(JWT_EXPIRES_IN_MS / 1000);
  
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId,
    username,
    iat: now,
    exp: expiresAt
  };
  
  return sign(header, payload, JWT_SECRET);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    if (!verifySignature(token, JWT_SECRET)) {
      return null;
    }
    
    const parts = token.split('.');
    const payloadStr = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadStr) as JwtPayload;
    
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

export function extractTokenFromHeader(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return null;
  }

  return parts[1];
}
