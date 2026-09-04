export interface CacheRecord<T = unknown> {
  key: string
  storedAt: number
  expiresAt: number
  value: T
}

/** Persistence boundary for current, authoritative provider responses. */
export interface CacheStore {
  get<T>(key: string, now?: number): CacheRecord<T> | null
  set<T>(record: CacheRecord<T>): void
  delete(key: string): void
  close?(): void
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheRecord>()

  get<T>(key: string, now = Date.now()): CacheRecord<T> | null {
    const record = this.entries.get(key)
    if (!record) return null
    if (record.expiresAt <= now) {
      this.entries.delete(key)
      return null
    }
    return record as CacheRecord<T>
  }

  set<T>(record: CacheRecord<T>) {
    this.entries.set(record.key, record)
  }

  delete(key: string) {
    this.entries.delete(key)
  }
}
