import Database from 'better-sqlite3'
import type { CacheRecord, CacheStore } from './cache-store.js'

export interface SQLiteCacheStoreOptions { maxEntries?: number }

interface Row { cache_key: string; stored_at: number; expires_at: number; payload: string }

export class SQLiteCacheStore implements CacheStore {
  private readonly database: Database.Database
  private readonly maxEntries: number

  constructor(path: string, options: SQLiteCacheStoreOptions = {}) {
    this.database = new Database(path)
    this.maxEntries = options.maxEntries ?? 200
    this.database.pragma('journal_mode = WAL')
    this.database.pragma('busy_timeout = 5000')
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS train_cache (
        cache_key TEXT PRIMARY KEY, stored_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL, payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS train_cache_expires_at ON train_cache(expires_at);
    `)
  }

  get<T>(key: string, now = Date.now()): CacheRecord<T> | null {
    const row = this.database.prepare(
      'SELECT cache_key, stored_at, expires_at, payload FROM train_cache WHERE cache_key = ?',
    ).get(key) as Row | undefined
    if (!row) return null
    if (row.expires_at <= now) { this.delete(key); return null }
    try {
      return { key: row.cache_key, storedAt: row.stored_at, expiresAt: row.expires_at, value: JSON.parse(row.payload) as T }
    } catch {
      this.delete(key)
      return null
    }
  }

  set<T>(record: CacheRecord<T>) {
    this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO train_cache (cache_key, stored_at, expires_at, payload) VALUES (?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET stored_at = excluded.stored_at,
          expires_at = excluded.expires_at, payload = excluded.payload
      `).run(record.key, record.storedAt, record.expiresAt, JSON.stringify(record.value))
      this.database.prepare('DELETE FROM train_cache WHERE expires_at <= ?').run(record.storedAt)
      this.database.prepare(`
        DELETE FROM train_cache WHERE cache_key IN (
          SELECT cache_key FROM train_cache ORDER BY stored_at DESC, cache_key DESC LIMIT -1 OFFSET ?
        )
      `).run(this.maxEntries)
    })()
  }

  delete(key: string) { this.database.prepare('DELETE FROM train_cache WHERE cache_key = ?').run(key) }
  close() { this.database.close() }
}
