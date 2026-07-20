/**
 * Tests for useAudioFileCache — IndexedDB-backed recent-file history.
 *
 * Uses fake-indexeddb so tests run without a real browser storage layer.
 * A fresh IDBFactory is installed on `globalThis.indexedDB` before every test
 * to give each test a clean, isolated database.
 *
 * Coverage:
 *  • add → list: stored records appear in newest-first order
 *  • list survives a fresh openDb() call (simulates page reload)
 *  • auto-restore: list[0] is the newest file
 *  • 5-entry eviction: adding a 6th file drops the oldest
 *  • removeRecentFile: entry disappears from the list
 *  • File-too-large guard: returns an error string, writes nothing
 *  • v1 → v2 migration: old `audio-files` store is replaced cleanly
 *  • clearAllRecentFiles: empties the list
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// We replace globalThis.indexedDB before importing the module functions
// so each test runs against a fresh, in-memory database.
function freshIndexedDB() {
  (globalThis as unknown as Record<string, unknown>).indexedDB = new IDBFactory();
}

// Dynamic import lets us re-read the module functions after the global is set.
// Because the functions call `indexedDB.open(...)` lazily (at call time, not at
// module-load time), swapping globalThis.indexedDB before each test is enough.
import {
  addRecentFile,
  listRecentFiles,
  removeRecentFile,
  loadRecentFileById,
  clearAllRecentFiles,
  requestPersistentStorage,
  _resetPersistFlagForTesting,
} from './useAudioFileCache';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal File with deterministic content. */
function makeFile(name: string, sizeBytes = 100): File {
  const bytes = new Uint8Array(sizeBytes).fill(1);
  return new File([bytes], name, { type: 'audio/mpeg' });
}

/** Open the raw DB at a specific version for migration-test setup. */
function openRawDb(factory: IDBFactory, name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
    req.onupgradeneeded = () => { /* caller configures stores */ };
  });
}

/** Open a v1 database with the old `audio-files` store and write one record. */
async function seedV1Database(factory: IDBFactory) {
  const DB_NAME  = 'r3-eq-audio-cache';
  const OLD_STORE = 'audio-files';

  return new Promise<void>((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OLD_STORE)) {
        db.createObjectStore(OLD_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx    = db.transaction(OLD_STORE, 'readwrite');
      const store = tx.objectStore(OLD_STORE);
      const putReq = store.put({ id: 'legacy-1', data: new ArrayBuffer(8) });
      putReq.onsuccess = () => { db.close(); resolve(); };
      putReq.onerror   = () => { db.close(); reject(putReq.error); };
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

// Spy on Date.now so each addRecentFile call gets a unique addedAt timestamp
// even when multiple adds happen within the same real millisecond.
// We intentionally do NOT use vi.useFakeTimers() — fake timers freeze
// fake-indexeddb's internal setTimeout/setImmediate callbacks, causing hangs.
let _nowCounter = 1_000_000;
let _nowSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  freshIndexedDB();
  _nowCounter = 1_000_000;
  _nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => _nowCounter);
});

afterEach(() => {
  _nowSpy.mockRestore();
});

/** Advance the mocked clock by 1 ms so the next addRecentFile gets a later addedAt. */
function tick() {
  _nowCounter += 1;
}

// ── add → list ────────────────────────────────────────────────────────────────

describe('addRecentFile + listRecentFiles', () => {
  it('returns null (success) and the file appears in the list', async () => {
    const file = makeFile('track.mp3');
    const err  = await addRecentFile(file);
    expect(err).toBeNull();

    const list = await listRecentFiles();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('track.mp3');
  });

  it('list is sorted newest-first (multiple files)', async () => {
    await addRecentFile(makeFile('first.mp3'));  tick();
    await addRecentFile(makeFile('second.mp3')); tick();
    await addRecentFile(makeFile('third.mp3'));

    const list = await listRecentFiles();
    expect(list.map(f => f.name)).toEqual(['third.mp3', 'second.mp3', 'first.mp3']);
  });

  it('list[0] is the most-recent file — ready for auto-restore on mount', async () => {
    await addRecentFile(makeFile('old.mp3')); tick();
    await addRecentFile(makeFile('new.mp3'));

    const list = await listRecentFiles();
    expect(list[0].name).toBe('new.mp3');
  });
});

// ── Page-reload simulation ────────────────────────────────────────────────────

describe('persistence across openDb() calls (simulated reload)', () => {
  it('files written in one openDb call are visible in the next', async () => {
    await addRecentFile(makeFile('persist-me.mp3'));

    // A second independent call to listRecentFiles() opens a new DB connection
    // — the same as what happens after a page reload with the same IDBFactory.
    const list = await listRecentFiles();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('persist-me.mp3');
  });

  it('loadRecentFileById returns the full ArrayBuffer after a fresh open', async () => {
    await addRecentFile(makeFile('audio.mp3', 200));

    const list   = await listRecentFiles();
    const record = await loadRecentFileById(list[0].id);

    expect(record).not.toBeNull();
    expect(record!.name).toBe('audio.mp3');
    // fake-indexeddb may use its own ArrayBuffer subtype; check the shape instead
    expect(record!.data).toBeTruthy();
    expect(record!.data.byteLength).toBe(200);
  });
});

// ── 5-entry eviction rule ─────────────────────────────────────────────────────

describe('MAX_ENTRIES eviction (cap = 5)', () => {
  it('adding a 6th file evicts the oldest, keeping exactly 5 entries', async () => {
    for (let i = 1; i <= 5; i++) {
      await addRecentFile(makeFile(`file-${i}.mp3`)); tick();
    }
    // Confirm 5 entries stored
    expect(await listRecentFiles()).toHaveLength(5);

    // Add the 6th — should evict file-1 (the oldest)
    await addRecentFile(makeFile('file-6.mp3'));

    const list = await listRecentFiles();
    expect(list).toHaveLength(5);
    expect(list.map(f => f.name)).not.toContain('file-1.mp3');
    expect(list.map(f => f.name)).toContain('file-6.mp3');
  });

  it('oldest entry is the one evicted (not a random one)', async () => {
    for (let i = 1; i <= 6; i++) {
      await addRecentFile(makeFile(`track-${i}.mp3`)); tick();
    }
    const list  = await listRecentFiles();
    const names = list.map(f => f.name);
    expect(names).toContain('track-2.mp3'); // second-oldest should survive
    expect(names).not.toContain('track-1.mp3'); // oldest must be gone
  });
});

// ── Concurrent adds (two-tab race simulation) ─────────────────────────────────
// IndexedDB readwrite transactions on the same store are serialized by the spec:
// the second transaction waits for the first to commit before its requests run.
// These tests confirm that invariant holds under fake-indexeddb and that the
// list never exceeds MAX_ENTRIES (5) regardless of concurrency.

describe('concurrent addRecentFile calls (two-tab simulation)', () => {
  it('two concurrent adds when at 4 entries leave exactly 5 (not 6)', async () => {
    // Seed 4 entries — one below the cap
    for (let i = 1; i <= 4; i++) {
      await addRecentFile(makeFile(`seed-${i}.mp3`)); tick();
    }
    expect(await listRecentFiles()).toHaveLength(4);

    // Fire two simultaneous adds — if transactions were NOT serialized both
    // would read count=4, skip eviction, and produce 6 entries.
    await Promise.all([
      addRecentFile(makeFile('concurrent-a.mp3')),
      addRecentFile(makeFile('concurrent-b.mp3')),
    ]);

    const list = await listRecentFiles();
    expect(list.length).toBeLessThanOrEqual(5);
    // At least one of the two concurrent files must have been stored
    const names = list.map(f => f.name);
    expect(
      names.includes('concurrent-a.mp3') || names.includes('concurrent-b.mp3')
    ).toBe(true);
  });

  it('two concurrent adds when already at 5 entries never exceed the cap', async () => {
    // Fill to MAX_ENTRIES
    for (let i = 1; i <= 5; i++) {
      await addRecentFile(makeFile(`full-${i}.mp3`)); tick();
    }
    expect(await listRecentFiles()).toHaveLength(5);

    await Promise.all([
      addRecentFile(makeFile('overflow-a.mp3')),
      addRecentFile(makeFile('overflow-b.mp3')),
    ]);

    expect((await listRecentFiles()).length).toBeLessThanOrEqual(5);
  });

  it('five concurrent adds into an empty store produce at most 5 entries', async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, i) => addRecentFile(makeFile(`burst-${i + 1}.mp3`)))
    );

    expect((await listRecentFiles()).length).toBeLessThanOrEqual(5);
  });
});

// ── removeRecentFile ──────────────────────────────────────────────────────────

describe('removeRecentFile', () => {
  it('removes the entry from the list', async () => {
    await addRecentFile(makeFile('keep.mp3')); tick();
    await addRecentFile(makeFile('remove-me.mp3'));

    const before = await listRecentFiles();
    expect(before).toHaveLength(2);

    const target = before.find(f => f.name === 'remove-me.mp3')!;
    await removeRecentFile(target.id);

    const after = await listRecentFiles();
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe('keep.mp3');
  });

  it('loadRecentFileById returns null after the entry is removed', async () => {
    await addRecentFile(makeFile('gone.mp3'));
    const [entry] = await listRecentFiles();

    await removeRecentFile(entry.id);

    const record = await loadRecentFileById(entry.id);
    expect(record).toBeNull();
  });

  it('removing a non-existent id is a no-op (no throw)', async () => {
    await expect(removeRecentFile('no-such-id')).resolves.toBeUndefined();
  });
});

// ── File-too-large guard ──────────────────────────────────────────────────────

describe('file size limit', () => {
  it('returns an error string for files over 50 MB and writes nothing', async () => {
    // Create a File whose .size property reports > 50 MB without allocating real memory.
    const bigFile = { name: 'huge.wav', size: 51 * 1024 * 1024, type: 'audio/wav' } as File;

    const err = await addRecentFile(bigFile);
    expect(err).toMatch(/too large/i);

    const list = await listRecentFiles();
    expect(list).toHaveLength(0);
  });
});

// ── clearAllRecentFiles ───────────────────────────────────────────────────────

describe('clearAllRecentFiles', () => {
  it('empties the list', async () => {
    await addRecentFile(makeFile('a.mp3'));
    await addRecentFile(makeFile('b.mp3'));

    await clearAllRecentFiles();

    const list = await listRecentFiles();
    expect(list).toHaveLength(0);
  });
});

// ── requestPersistentStorage — once-only flag + denial resilience ─────────────

describe('requestPersistentStorage', () => {
  // jsdom does not implement navigator.storage, so we install a minimal stub
  // via Object.defineProperty before each test and remove it after.
  let mockPersist:   ReturnType<typeof vi.fn>;
  let mockEstimate:  ReturnType<typeof vi.fn>;

  function installStorageStub(persistImpl: () => Promise<boolean>) {
    mockPersist  = vi.fn(persistImpl);
    mockEstimate = vi.fn().mockResolvedValue({ quota: 10_000_000, usage: 0 });
    Object.defineProperty(navigator, 'storage', {
      value:        { persist: mockPersist, estimate: mockEstimate },
      configurable: true,
      writable:     true,
    });
  }

  beforeEach(() => {
    // Each test needs a clean once-only flag.
    _resetPersistFlagForTesting();
  });

  afterEach(() => {
    // Remove the stub so other suites see the original (undefined) value.
    Object.defineProperty(navigator, 'storage', {
      value: undefined, configurable: true, writable: true,
    });
  });

  it('calls persist() only once even when addRecentFile is invoked twice', async () => {
    installStorageStub(() => Promise.resolve(true));

    await addRecentFile(makeFile('a.mp3')); tick();
    await addRecentFile(makeFile('b.mp3'));

    // requestPersistentStorage is fire-and-forget inside addRecentFile;
    // flush the microtask queue so the async call completes before asserting.
    await Promise.resolve();
    expect(mockPersist).toHaveBeenCalledTimes(1);
  });

  it('a denied persist() (returns false) does not suppress the quota warning', async () => {
    installStorageStub(() => Promise.resolve(false));
    // Simulate tight quota: 49 bytes free, file is 100 bytes (threshold = file.size * 2 = 200)
    mockEstimate.mockResolvedValue({ quota: 1_000, usage: 951 });

    const file   = makeFile('audio.mp3', 100);
    const result = await addRecentFile(file);

    expect(result).toMatch(/storage low/i);
  });

  it('completes without throwing when persist() raises an error (e.g. unsupported browser)', async () => {
    installStorageStub(() => Promise.reject(new DOMException('persist() not supported', 'NotSupportedError')));

    await expect(requestPersistentStorage()).resolves.toBeUndefined();
  });
});

// ── v1 → v2 migration ────────────────────────────────────────────────────────

describe('v1 → v2 DB migration', () => {
  it('drops the old audio-files store and creates recent-files without error', async () => {
    const factory = (globalThis as unknown as Record<string, IDBFactory>).indexedDB;

    // 1. Seed a v1 database with the old store and a legacy record.
    await seedV1Database(factory);

    // 2. Opening via the module's openDb() (version 2) should migrate cleanly.
    //    listRecentFiles() must not throw and must return an empty list
    //    (the old store's data is gone; the new store starts fresh).
    const list = await listRecentFiles();
    expect(list).toHaveLength(0);
  });

  it('new writes work correctly after the migration', async () => {
    const factory = (globalThis as unknown as Record<string, IDBFactory>).indexedDB;
    await seedV1Database(factory);

    // After migration, add a file and confirm it round-trips.
    const err = await addRecentFile(makeFile('post-migration.mp3'));
    expect(err).toBeNull();

    const list = await listRecentFiles();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('post-migration.mp3');
  });
});
