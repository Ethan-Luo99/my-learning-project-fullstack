import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateToken, verifyToken, extractTokenFromHeader } from '~/server/utils/jwt'
import { createHmac, timingSafeEqual } from 'crypto'

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

describe('jwt utilities', () => {
  describe('generateToken function', () => {
    it('should generate a token with userId and username', () => {
      const userId = 'test-user-id-123'
      const username = 'testuser'
      
      const token = generateToken(userId, username)
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3)
    })

    it('should generate different tokens for different users', () => {
      const token1 = generateToken('user-1', 'username1')
      const token2 = generateToken('user-2', 'username2')
      
      expect(token1).not.toBe(token2)
    })

    it('should generate valid JWT format', () => {
      const token = generateToken('test-id', 'testuser')
      const parts = token.split('.')
      
      expect(parts.length).toBe(3)
      
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString())
      expect(header.alg).toBe('HS256')
      expect(header.typ).toBe('JWT')
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      expect(payload.userId).toBe('test-id')
      expect(payload.username).toBe('testuser')
      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()
    })
  })

  describe('verifyToken function', () => {
    it('should return payload for valid token', () => {
      const userId = 'test-user-id'
      const username = 'testuser'
      const token = generateToken(userId, username)
      
      const payload = verifyToken(token)
      
      expect(payload).not.toBeNull()
      expect(payload?.userId).toBe(userId)
      expect(payload?.username).toBe(username)
    })

    it('should return null for invalid token signature', () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwidXNlcm5hbWUiOiJ0ZXN0dXNlciJ9.invalid-signature'
      
      const payload = verifyToken(invalidToken)
      
      expect(payload).toBeNull()
    })

    it('should return null for malformed token', () => {
      const malformedToken = 'not-a-valid-token'
      
      const payload = verifyToken(malformedToken)
      
      expect(payload).toBeNull()
    })

    it('should return null for empty token', () => {
      const payload = verifyToken('')
      
      expect(payload).toBeNull()
    })

    it('should return null for expired token', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000))
      
      const expiredToken = generateToken('expired-user', 'expired')
      
      vi.useRealTimers()
      
      const payload = verifyToken(expiredToken)
      
      expect(payload).toBeNull()
    })

    it('should return payload for non-expired token', () => {
      const token = generateToken('valid-user', 'valid')
      
      const payload = verifyToken(token)
      
      expect(payload).not.toBeNull()
      expect(payload?.userId).toBe('valid-user')
    })
  })

  describe('extractTokenFromHeader function', () => {
    it('should extract token from valid Bearer header', () => {
      const authorization = 'Bearer valid-jwt-token-123'
      
      const token = extractTokenFromHeader(authorization)
      
      expect(token).toBe('valid-jwt-token-123')
    })

    it('should return null for undefined header', () => {
      const token = extractTokenFromHeader(undefined)
      
      expect(token).toBeNull()
    })

    it('should return null for invalid header format', () => {
      const invalidHeaders = [
        '',
        'InvalidScheme token',
        'Bearer',
        'Bearer ',
        'Bearer token extra'
      ]
      
      invalidHeaders.forEach(header => {
        const token = extractTokenFromHeader(header)
        expect(token).toBeNull()
      })
    })

    it('should be case sensitive for Bearer scheme', () => {
      const authorization = 'bearer lowercase-token'
      
      const token = extractTokenFromHeader(authorization)
      
      expect(token).toBeNull()
    })
  })

  describe('JWT payload structure', () => {
    it('should have correct payload structure when verifying valid token', () => {
      const token = generateToken('test-id', 'testuser')
      const payload = verifyToken(token)
      
      expect(payload).toBeDefined()
      expect(payload?.userId).toBeDefined()
      expect(typeof payload?.userId).toBe('string')
      expect(payload?.username).toBeDefined()
      expect(typeof payload?.username).toBe('string')
    })

    it('should include iat and exp in payload', () => {
      const token = generateToken('test-id', 'testuser')
      const payload = verifyToken(token)
      
      expect(payload?.iat).toBeDefined()
      expect(payload?.exp).toBeDefined()
      expect(typeof payload?.iat).toBe('number')
      expect(typeof payload?.exp).toBe('number')
    })

    it('should have exp set to 7 days after iat', () => {
      const token = generateToken('test-id', 'testuser')
      const payload = verifyToken(token)
      
      expect(payload?.exp).toBeGreaterThan(payload?.iat || 0)
      const sevenDaysInSeconds = 7 * 24 * 60 * 60
      expect((payload?.exp || 0) - (payload?.iat || 0)).toBe(sevenDaysInSeconds)
    })
  })

  describe('JWT signature verification', () => {
    it('should reject tokens signed with different secret', () => {
      const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const payload = base64UrlEncode(JSON.stringify({ userId: 'test', username: 'testuser', iat: Date.now() / 1000, exp: Date.now() / 1000 + 86400 }))
      
      const signatureInput = `${header}.${payload}`
      const wrongSecret = 'wrong-secret-key'
      const signature = createHmac('sha256', wrongSecret)
        .update(signatureInput)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      
      const tokenWithWrongSecret = `${signatureInput}.${signature}`
      
      const result = verifyToken(tokenWithWrongSecret)
      
      expect(result).toBeNull()
    })

    it('should reject tokens with tampered payload', () => {
      const originalToken = generateToken('original-user', 'original')
      const parts = originalToken.split('.')
      
      const tamperedPayload = base64UrlEncode(JSON.stringify({ userId: 'hacker', username: 'hacker', iat: Date.now() / 1000, exp: Date.now() / 1000 + 86400 }))
      
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`
      
      const result = verifyToken(tamperedToken)
      
      expect(result).toBeNull()
    })
  })
})
