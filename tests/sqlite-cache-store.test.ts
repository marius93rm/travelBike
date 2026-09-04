import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQLiteCacheStore } from '../server/cache/sqlite-cache-store.js'

const directories: string[] = []

function store(maxEntries = 200) {
  const directory = mkdtempSync(join(tmpdir(), 'travel-bike-cache-'))
  const path = join(directory, 'cache.sqlite')
  directories.push(directory)
  return new SQLiteCacheStore(path, { maxEntries })
}

describe('SQLiteCacheStore', () => {
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('persists entries between store instances and rejects expired values', () => {
    const first = store()
    first.set({ key: 'journey', storedAt: 10, expiresAt: 100, value: { empty: true } })
    first.close()
    const second = new SQLiteCacheStore(join(directories[0], 'cache.sqlite'))
    expect(second.get('journey', 99)?.value).toEqual({ empty: true })
    expect(second.get('journey', 100)).toBeNull()
    second.close()
  })

  it('prunes least-recently-stored entries beyond maxEntries', () => {
    const cache = store(2)
    cache.set({ key: 'one', storedAt: 1, expiresAt: 100, value: 1 })
    cache.set({ key: 'two', storedAt: 2, expiresAt: 100, value: 2 })
    cache.set({ key: 'three', storedAt: 3, expiresAt: 100, value: 3 })
    expect(cache.get('one', 4)).toBeNull()
    expect(cache.get('three', 4)?.value).toBe(3)
    cache.close()
  })
})
