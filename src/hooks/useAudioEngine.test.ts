/**
 * Regression tests for useAudioEngine — cacheError coalescing
 *
 * Verifies that loading multiple large files in quick succession does not
 * cause the storage-warning banner to flash/replace repeatedly. The first
 * warning sticks until the user dismisses it or a clean cache write arrives.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAudioEngine } from './useAudioEngine';

// ── Mock the IndexedDB cache module ───────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAddRecentFile: any = vi.fn();

vi.mock('./useAudioFileCache', () => ({
  addRecentFile:          () => mockAddRecentFile(),
  listRecentFiles:        vi.fn().mockResolvedValue([]),
  loadRecentFileById:     vi.fn().mockResolvedValue(null),
  removeRecentFile:       vi.fn().mockResolvedValue(undefined),
  clearAllRecentFiles:    vi.fn().mockResolvedValue(undefined),
  requestPersistentStorage: vi.fn().mockResolvedValue(undefined),
  checkDbAvailability:    vi.fn().mockResolvedValue(null),
}));

// ── Minimal AudioContext mock ──────────────────────────────────────────────────
const FAKE_BUFFER = { duration: 5, sampleRate: 44100, numberOfChannels: 2 };

function audioNode() {
  return {
    connect:    vi.fn(),
    disconnect: vi.fn(),
    type:       'peaking' as BiquadFilterType,
    frequency:  { linearRampToValueAtTime: vi.fn() },
    gain:       { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    Q:          { linearRampToValueAtTime: vi.fn() },
  };
}

function makeMockCtx() {
  return {
    state:       'running',
    currentTime: 0,
    destination: {},
    sampleRate:  44100,
    resume:           vi.fn().mockResolvedValue(undefined),
    close:            vi.fn().mockResolvedValue(undefined),
    createBiquadFilter: vi.fn(audioNode),
    createAnalyser:   vi.fn(() => ({
      ...audioNode(),
      fftSize: 4096, smoothingTimeConstant: 0,
      frequencyBinCount: 64,
      getFloatFrequencyData: vi.fn(),
    })),
    createGain:         vi.fn(audioNode),
    createBufferSource: vi.fn(() => ({
      ...audioNode(), start: vi.fn(), stop: vi.fn(),
      loop: false, buffer: null,
    })),
    createMediaStreamSource: vi.fn(audioNode),
    decodeAudioData: vi.fn().mockResolvedValue(FAKE_BUFFER),
  };
}

beforeEach(() => {
  mockAddRecentFile.mockReset();
  vi.stubGlobal('AudioContext',           vi.fn(makeMockCtx));
  vi.stubGlobal('requestAnimationFrame',  vi.fn(() => 0));
  vi.stubGlobal('cancelAnimationFrame',   vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

function makeFile(name: string): File {
  return new File([new Uint8Array(100)], name, { type: 'audio/mpeg' });
}

// Flush all pending microtasks + a single macrotask tick
async function flush() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAudioEngine — cacheError coalescing', () => {
  it('first quota warning is shown and NOT replaced when a second load also fails', async () => {
    const FIRST  = 'Storage low (1 MB free) — file cached but may be evicted by the browser';
    const SECOND = 'Not enough storage space — the file was played but could not be saved to history';
    mockAddRecentFile.mockResolvedValueOnce(FIRST).mockResolvedValueOnce(SECOND);

    const { result } = renderHook(() => useAudioEngine([], false));

    // First file load — banner appears with FIRST message
    await act(async () => { await result.current.loadFile(makeFile('a.mp3')); });
    await waitFor(() => expect(result.current.cacheError).toBe(FIRST));

    // Second file load while banner is still visible — must NOT overwrite
    await act(async () => { await result.current.loadFile(makeFile('b.mp3')); });
    await flush();

    expect(result.current.cacheError).toBe(FIRST); // unchanged
  });

  it('banner is cleared when a subsequent file caches cleanly', async () => {
    mockAddRecentFile
      .mockResolvedValueOnce('Storage low — file cached but may be evicted by the browser')
      .mockResolvedValueOnce(null); // second load succeeds cleanly

    const { result } = renderHook(() => useAudioEngine([], false));

    await act(async () => { await result.current.loadFile(makeFile('a.mp3')); });
    await waitFor(() => expect(result.current.cacheError).not.toBeNull());

    await act(async () => { await result.current.loadFile(makeFile('b.mp3')); });
    await flush();

    expect(result.current.cacheError).toBeNull();
  });

  it('a new warning can appear after the user explicitly dismisses the banner', async () => {
    const WARNING = 'Not enough storage space — the file was played but could not be saved to history';
    mockAddRecentFile.mockResolvedValue(WARNING);

    const { result } = renderHook(() => useAudioEngine([], false));

    // First load — banner shows
    await act(async () => { await result.current.loadFile(makeFile('a.mp3')); });
    await waitFor(() => expect(result.current.cacheError).toBe(WARNING));

    // User dismisses the banner (clear button)
    act(() => { result.current.setCacheError(null); });
    expect(result.current.cacheError).toBeNull();

    // Second load — new warning should appear since banner was dismissed
    await act(async () => { await result.current.loadFile(makeFile('b.mp3')); });
    await flush();

    expect(result.current.cacheError).toBe(WARNING);
  });
});
