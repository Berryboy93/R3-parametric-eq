/**
 * useAudioFileCache — persists the last loaded audio file in IndexedDB.
 *
 * Constraints:
 *   • Max file size: 50 MB (enforced on write, graceful error returned).
 *   • Only one file is stored at a time (the most recent one).
 *   • On every save the previous file is replaced, so storage stays bounded.
 */

const DB_NAME    = 'r3-eq-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio-files';
const RECORD_KEY = 'cached-file';

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export type CachedFileRecord = {
  name: string;
  type: string;
  data: ArrayBuffer;
};

// ── IndexedDB helpers ──────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Store an audio File in IndexedDB.
 * Returns `null` on success, or an error string if the file exceeds MAX_BYTES
 * or IndexedDB is unavailable.
 */
export async function cacheAudioFile(file: File): Promise<string | null> {
  if (file.size > MAX_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — maximum is 50 MB`;
  }
  try {
    const data: ArrayBuffer = await file.arrayBuffer();
    const db = await openDb();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: CachedFileRecord = { name: file.name, type: file.type, data };
      const req = store.put(record, RECORD_KEY);
      req.onsuccess = () => { db.close(); resolve(null); };
      req.onerror   = () => { db.close(); resolve(`Could not cache file: ${req.error?.message}`); };
    });
  } catch (err) {
    return `Cache unavailable: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Retrieve the previously cached audio file, or `null` if nothing is stored.
 */
export async function loadCachedAudioFile(): Promise<CachedFileRecord | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.get(RECORD_KEY);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror   = () => { db.close(); resolve(null); };
    });
  } catch {
    return null;
  }
}

/**
 * Delete the cached audio file.
 */
export async function clearCachedAudioFile(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.delete(RECORD_KEY);
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror   = () => { db.close(); resolve(); };
    });
  } catch {
    // Silently ignore
  }
}
