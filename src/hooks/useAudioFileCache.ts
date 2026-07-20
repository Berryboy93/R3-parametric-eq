/**
 * useAudioFileCache — persists the last 5 loaded audio files in IndexedDB.
 *
 * Constraints:
 *   • Max file size: 50 MB (enforced on write, graceful error returned).
 *   • Up to 5 files stored; oldest is evicted when the list is full.
 *   • DB version bumped to 2 — migrates away from the single-record v1 store.
 */

const DB_NAME    = 'r3-eq-audio-cache';
const DB_VERSION = 2;
const STORE_NAME = 'recent-files';
const OLD_STORE  = 'audio-files';

const MAX_BYTES   = 50 * 1024 * 1024; // 50 MB
const MAX_ENTRIES = 5;

// ── Persistent-storage request ─────────────────────────────────────────────────
// We ask the browser once per page load to promote this origin to "persistent"
// storage, which prevents IndexedDB data from being silently evicted under
// storage pressure.  The flag ensures we fire at most one request regardless of
// how many times addRecentFile is called.
let _persistRequested = false;

export async function requestPersistentStorage(): Promise<void> {
  if (_persistRequested) return;
  _persistRequested = true;
  try {
    if ('storage' in navigator && typeof navigator.storage.persist === 'function') {
      await navigator.storage.persist();
      // Result (true = granted, false = denied) is informational only; the
      // existing quota-warning path already handles the denied/unsupported case.
    }
  } catch {
    // persist() is not critical — silently ignore any error.
  }
}

export type RecentFileRecord = {
  id: string;        // unique — timestamp + random suffix
  name: string;
  size: number;      // original File.size in bytes
  type: string;
  data: ArrayBuffer;
  addedAt: number;   // Date.now() when stored
};

/** Lightweight descriptor returned by listRecentFiles (no ArrayBuffer). */
export type RecentFileMeta = Omit<RecentFileRecord, 'data'>;

// ── IndexedDB helpers ──────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db      = req.result;
      const oldVer  = event.oldVersion;

      // v1 → v2: drop the old single-record store, create the new list store
      if (oldVer < 2) {
        if (db.objectStoreNames.contains(OLD_STORE)) {
          db.deleteObjectStore(OLD_STORE);
        }
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortByNewest(records: RecentFileMeta[]): RecentFileMeta[] {
  return [...records].sort((a, b) => b.addedAt - a.addedAt);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Add a file to the recent list.
 * Evicts the oldest entry when more than MAX_ENTRIES would be stored.
 * Returns `null` on success, or an error string.
 */
export async function addRecentFile(file: File): Promise<string | null> {
  if (file.size > MAX_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — maximum is 50 MB`;
  }
  // Ask the browser to protect this origin's storage from silent eviction.
  // Fire-and-forget: we don't gate the write on the outcome.
  requestPersistentStorage();
  // Check available quota — non-blocking: the write always proceeds.
  // If space is tight we surface a warning after a successful write so the
  // user knows the file may be evicted under memory pressure.
  let quotaWarning: string | null = null;
  if ('storage' in navigator) {
    try {
      const { quota = 0, usage = 0 } = await navigator.storage.estimate();
      const available = quota - usage;
      if (available > 0 && available < file.size * 2) {
        quotaWarning = `Storage low (${(available / 1024 / 1024).toFixed(0)} MB free) — file cached but may be evicted by the browser`;
      }
    } catch { /* estimate not available in this browser */ }
  }
  try {
    const data: ArrayBuffer = await file.arrayBuffer();
    const db = await openDb();

    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // Read all existing records to check the count
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const existing: RecentFileRecord[] = getAllReq.result ?? [];

        // Sort oldest-first so we can evict from the front
        const sorted = [...existing].sort((a, b) => a.addedAt - b.addedAt);

        // Evict oldest entries until we're under the limit (making room for the new one)
        const toDelete = sorted.slice(0, Math.max(0, sorted.length - MAX_ENTRIES + 1));
        for (const old of toDelete) {
          store.delete(old.id);
        }

        const record: RecentFileRecord = {
          id:      makeId(),
          name:    file.name,
          size:    file.size,
          type:    file.type,
          data,
          addedAt: Date.now(),
        };

        const putReq = store.put(record);
        // Return quotaWarning on success so the caller can surface it;
        // null means "cached cleanly with no concerns".
        putReq.onsuccess = () => { db.close(); resolve(quotaWarning); };
        putReq.onerror   = () => { db.close(); resolve(`Could not cache file: ${putReq.error?.message}`); };
      };
      getAllReq.onerror = () => { db.close(); resolve(`Could not read cache: ${getAllReq.error?.message}`); };
    });
  } catch (err) {
    return `Cache unavailable: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Return metadata for all recent files, newest first.
 * Never rejects — returns an empty array on any error.
 */
export async function listRecentFiles(): Promise<RecentFileMeta[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.getAll();
      req.onsuccess = () => {
        db.close();
        const records: RecentFileMeta[] = (req.result ?? []).map(
          ({ id, name, size, type, addedAt }) => ({ id, name, size, type, addedAt })
        );
        resolve(sortByNewest(records));
      };
      req.onerror = () => { db.close(); resolve([]); };
    });
  } catch {
    return [];
  }
}

/**
 * Load the full ArrayBuffer for a specific recent file by id.
 * Returns `null` if not found or on error.
 */
export async function loadRecentFileById(id: string): Promise<RecentFileRecord | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.get(id);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror   = () => { db.close(); resolve(null); };
    });
  } catch {
    return null;
  }
}

/**
 * Remove a single entry from the recent list by id.
 */
export async function removeRecentFile(id: string): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.delete(id);
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror   = () => { db.close(); resolve(); };
    });
  } catch {
    // Silently ignore
  }
}

/**
 * Clear all recent files.
 */
export async function clearAllRecentFiles(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.clear();
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror   = () => { db.close(); resolve(); };
    });
  } catch {
    // Silently ignore
  }
}

// ── Legacy compatibility shims ─────────────────────────────────────────────────
// Kept so any other code that might import the old names doesn't break during
// the transition.

/** @deprecated Use addRecentFile instead */
export async function cacheAudioFile(file: File): Promise<string | null> {
  return addRecentFile(file);
}

/** @deprecated Use listRecentFiles + loadRecentFileById instead */
export async function loadCachedAudioFile() {
  const list = await listRecentFiles();
  if (list.length === 0) return null;
  return loadRecentFileById(list[0].id);
}

/** @deprecated Use clearAllRecentFiles instead */
export async function clearCachedAudioFile(): Promise<void> {
  return clearAllRecentFiles();
}

export type CachedFileRecord = RecentFileRecord;
