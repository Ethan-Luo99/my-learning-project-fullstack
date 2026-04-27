import bcrypt from 'bcryptjs';
import { getDb } from './db';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  avatar: string | null;
  createdAt: string;
}

export type UserData = User;

const SALT_ROUNDS = 10;

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id || ''),
    username: String(row.username || ''),
    passwordHash: String(row.passwordHash || ''),
    avatar: row.avatar !== null && row.avatar !== undefined ? String(row.avatar) : null,
    createdAt: String(row.createdAt || '')
  };
}

export function findUserByUsername(username: string): User | undefined {
  const db = getDb();
  
  const row = db.prepare(`
    SELECT id, username, passwordHash, avatar, createdAt
    FROM users
    WHERE username = ?
  `).get(username);
  
  return row ? rowToUser(row as Record<string, unknown>) : undefined;
}

export function findUserById(id: string): User | undefined {
  const db = getDb();
  
  const row = db.prepare(`
    SELECT id, username, passwordHash, avatar, createdAt
    FROM users
    WHERE id = ?
  `).get(id);
  
  return row ? rowToUser(row as Record<string, unknown>) : undefined;
}

export function createUserWithHash(username: string, passwordHash: string): User {
  const db = getDb();
  const id = generateId();
  const avatar: string | null = null;
  const createdAt = getCurrentTimestamp();
  
  db.prepare(`
    INSERT INTO users (id, username, passwordHash, avatar, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, passwordHash, avatar, createdAt);
  
  return {
    id,
    username,
    passwordHash,
    avatar,
    createdAt
  };
}

export function createUserFromData(userData: UserData): User {
  const db = getDb();
  
  db.prepare(`
    INSERT INTO users (id, username, passwordHash, avatar, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(userData.id, userData.username, userData.passwordHash, userData.avatar, userData.createdAt);
  
  return { ...userData };
}

export async function createUser(username: string, password: string): Promise<User> {
  const passwordHash = await hashPassword(password);
  return createUserWithHash(username, passwordHash);
}

export function updateUser(
  id: string,
  updates: Partial<Omit<UserData, 'id' | 'createdAt'>>
): User | undefined {
  const db = getDb();
  const existingUser = findUserById(id);
  
  if (!existingUser) {
    return undefined;
  }
  
  const updateFields: string[] = [];
  const updateValues: unknown[] = [];
  
  if (updates.username !== undefined) {
    updateFields.push('username = ?');
    updateValues.push(updates.username);
  }
  
  if (updates.passwordHash !== undefined) {
    updateFields.push('passwordHash = ?');
    updateValues.push(updates.passwordHash);
  }
  
  if ('avatar' in updates) {
    updateFields.push('avatar = ?');
    updateValues.push(updates.avatar);
  }
  
  if (updateFields.length === 0) {
    return existingUser;
  }
  
  updateValues.push(id);
  
  const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...updateValues);
  
  return findUserById(id);
}

export function deleteUser(id: string): boolean {
  const db = getDb();
  const existingUser = findUserById(id);
  
  if (!existingUser) {
    return false;
  }
  
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  
  return result.changes > 0;
}

export function getAllUsers(): User[] {
  const db = getDb();
  
  const rows = db.prepare(`
    SELECT id, username, passwordHash, avatar, createdAt
    FROM users
    ORDER BY createdAt DESC
  `).all() as Array<Record<string, unknown>>;
  
  return rows.map(row => rowToUser(row));
}

export function isUsernameAvailable(username: string): boolean {
  const existingUser = findUserByUsername(username);
  return existingUser === undefined;
}

export function getUserCount(): number {
  const db = getDb();
  
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  
  return result.count;
}
