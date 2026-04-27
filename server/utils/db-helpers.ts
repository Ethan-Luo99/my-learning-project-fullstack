import Database from 'better-sqlite3';
import { getDb } from './db';

export interface QueryOptions {
  db?: Database.Database;
}

export function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  options: QueryOptions = {}
): T[] {
  const db = options.db || getDb();
  
  try {
    const stmt = db.prepare(sql);
    const result = stmt.all(...params) as T[];
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DB Helper] queryAll 错误:', errorMsg);
    console.error('[DB Helper] SQL:', sql);
    console.error('[DB Helper] Params:', params);
    throw error;
  }
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  options: QueryOptions = {}
): T | undefined {
  const db = options.db || getDb();
  
  try {
    const stmt = db.prepare(sql);
    const result = stmt.get(...params) as T | undefined;
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DB Helper] queryOne 错误:', errorMsg);
    console.error('[DB Helper] SQL:', sql);
    console.error('[DB Helper] Params:', params);
    throw error;
  }
}

export interface WriteResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export function executeWrite(
  sql: string,
  params: unknown[] = [],
  options: QueryOptions = {}
): WriteResult {
  const db = options.db || getDb();
  
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DB Helper] executeWrite 错误:', errorMsg);
    console.error('[DB Helper] SQL:', sql);
    console.error('[DB Helper] Params:', params);
    throw error;
  }
}

export function executeBatch(
  sql: string,
  paramsArray: unknown[][],
  options: QueryOptions = {}
): WriteResult[] {
  const db = options.db || getDb();
  const results: WriteResult[] = [];
  
  try {
    const stmt = db.prepare(sql);
    
    for (const params of paramsArray) {
      const result = stmt.run(...params);
      results.push({
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      });
    }
    
    return results;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DB Helper] executeBatch 错误:', errorMsg);
    console.error('[DB Helper] SQL:', sql);
    console.error('[DB Helper] 已执行:', results.length, '/', paramsArray.length);
    throw error;
  }
}

export function runInTransaction<T>(
  fn: (db: Database.Database) => T,
  options: QueryOptions = {}
): T {
  const db = options.db || getDb();
  
  try {
    const transaction = db.transaction(fn);
    return transaction(db);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DB Helper] runInTransaction 错误:', errorMsg);
    throw error;
  }
}

export function runInTransactionAsync<T>(
  fn: (db: Database.Database) => Promise<T>,
  options: QueryOptions = {}
): Promise<T> {
  const db = options.db || getDb();
  
  return new Promise((resolve, reject) => {
    try {
      db.exec('BEGIN TRANSACTION');
      
      fn(db)
        .then((result) => {
          db.exec('COMMIT');
          resolve(result);
        })
        .catch((error) => {
          db.exec('ROLLBACK');
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('[DB Helper] runInTransactionAsync 错误:', errorMsg);
          reject(error);
        });
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // 忽略回滚错误
      }
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[DB Helper] runInTransactionAsync 启动错误:', errorMsg);
      reject(error);
    }
  });
}

export function buildWhereClause(
  conditions: Record<string, unknown>
): { clause: string; params: unknown[] } {
  const keys = Object.keys(conditions);
  
  if (keys.length === 0) {
    return { clause: '', params: [] };
  }
  
  const clauses: string[] = [];
  const params: unknown[] = [];
  
  for (const key of keys) {
    const value = conditions[key];
    
    if (value === null || value === undefined) {
      clauses.push(`${key} IS NULL`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        clauses.push('1=0');
      } else {
        const placeholders = value.map(() => '?').join(', ');
        clauses.push(`${key} IN (${placeholders})`);
        params.push(...value);
      }
    } else {
      clauses.push(`${key} = ?`);
      params.push(value);
    }
  }
  
  return {
    clause: `WHERE ${clauses.join(' AND ')}`,
    params
  };
}

export function buildInsertClause(
  table: string,
  data: Record<string, unknown>
): { sql: string; params: unknown[] } {
  const keys = Object.keys(data);
  
  if (keys.length === 0) {
    throw new Error('插入数据不能为空');
  }
  
  const columns = keys.join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const params = keys.map(key => data[key]);
  
  return {
    sql: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
    params
  };
}

export function buildUpdateClause(
  table: string,
  data: Record<string, unknown>,
  where: Record<string, unknown>
): { sql: string; params: unknown[] } {
  const dataKeys = Object.keys(data);
  
  if (dataKeys.length === 0) {
    throw new Error('更新数据不能为空');
  }
  
  const setClauses = dataKeys.map(key => `${key} = ?`);
  const setParams = dataKeys.map(key => data[key]);
  
  const { clause: whereClause, params: whereParams } = buildWhereClause(where);
  
  if (!whereClause) {
    throw new Error('更新操作必须包含 WHERE 条件');
  }
  
  return {
    sql: `UPDATE ${table} SET ${setClauses.join(', ')} ${whereClause}`,
    params: [...setParams, ...whereParams]
  };
}

export {
  queryAll as all,
  queryOne as one,
  executeWrite as write,
  executeBatch as batch,
  runInTransaction as transaction,
  runInTransactionAsync as transactionAsync
};
