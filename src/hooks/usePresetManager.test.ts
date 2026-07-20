/**
 * Tests for usePresetManager hook error states
 *
 * Mocks global `fetch` so tests run without a real server.
 * Covers:
 *  • loadError is set when both retry attempts fail during init
 *  • loadError is absent when init succeeds
 *  • saveError is set when the save API call fails
 *  • saveError is cleared after a subsequent successful save
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { usePresetManager } from './usePresetManager';
import type { EQState } from '../dsp';

const LOAD_ERROR_MSG = 'Could not load presets — check your connection and try again.';
const SAVE_ERROR_MSG = 'Could not save preset — please try again.';

// Minimal EQState — PresetManager only stores the value, so structure doesn't matter for error tests
const DUMMY_STATE = {
  inputGain: 0, outputGain: 0, bypass: false,
  analyzerEnabled: true, linearPhase: false,
  oversampling: false, autoGain: false,
  bands: [],
} as unknown as EQState;

function fetchOk(data: unknown = []): Response {
  return { ok: true, status: 200, json: async () => data } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe('usePresetManager — loadError', () => {
  it('is set when both retry attempts fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => usePresetManager());
    await waitFor(() => expect(result.current.initialized).toBe(true));

    expect(result.current.loadError).toBe(LOAD_ERROR_MSG);
    expect(result.current.userPresets).toHaveLength(0);
    // fetch was called twice (one attempt + one retry)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('is null when init succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk([])));

    const { result } = renderHook(() => usePresetManager());
    await waitFor(() => expect(result.current.initialized).toBe(true));

    expect(result.current.loadError).toBeNull();
  });
});

describe('usePresetManager — saveError', () => {
  it('is set when the save call fails', async () => {
    // GET /api/presets succeeds; POST /api/presets always fails
    vi.stubGlobal('fetch', vi.fn().mockImplementation(
      async (_url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? Promise.reject(new Error('Write failed'))
          : fetchOk([]),
    ));

    const { result } = renderHook(() => usePresetManager());
    await waitFor(() => expect(result.current.initialized).toBe(true));

    await act(async () => {
      await result.current.savePreset('My Preset', DUMMY_STATE);
    });

    expect(result.current.saveError).toBe(SAVE_ERROR_MSG);
  });

  it('is cleared after a subsequent successful save', async () => {
    // fetchWithRetry makes 2 attempts per call, so the first savePreset()
    // needs both attempts (postCount 1 & 2) to fail before it throws.
    let postCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(
      async (_url: string, init?: RequestInit) => {
        if (init?.method !== 'POST') return fetchOk([]);
        postCount++;
        if (postCount <= 2) throw new Error('Temporary failure'); // both attempts of first save fail
        return fetchOk({});
      },
    ));

    const { result } = renderHook(() => usePresetManager());
    await waitFor(() => expect(result.current.initialized).toBe(true));

    // First save fails — error is set
    await act(async () => { await result.current.savePreset('Preset A', DUMMY_STATE); });
    expect(result.current.saveError).toBe(SAVE_ERROR_MSG);

    // Second save succeeds — error is cleared
    await act(async () => { await result.current.savePreset('Preset B', DUMMY_STATE); });
    expect(result.current.saveError).toBeNull();
  });
});
