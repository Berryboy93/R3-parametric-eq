/**
 * Tests for ApiPresetStorage.fetchWithRetry
 *
 * Covers the three retry/error scenarios the task requires:
 *  1. Single failure → retry → success
 *  2. Two consecutive network failures → throws
 *  3. Two consecutive non-OK HTTP responses → throws
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiPresetStorage } from './api-storage';
import type { EQPreset } from '../types/index';

const MOCK_PRESET: EQPreset = {
  id: 'test-preset',
  name: 'Test',
  category: 'Custom',
  description: '',
  tags: [],
  isFactory: false,
  createdAt: 1000,
  updatedAt: 1000,
  state: {
    inputGain: 0, outputGain: 0, bypass: false,
    analyzerEnabled: true, linearPhase: false,
    oversampling: false, autoGain: false,
    bands: [],
  } as never,
};

function okResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
  } as Response;
}

function errResponse(status = 503, msg = 'Service Unavailable'): Response {
  return {
    ok: false,
    status,
    statusText: msg,
    json: async () => ({}),
  } as Response;
}

describe('ApiPresetStorage — fetchWithRetry', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('retries once on a network error and resolves on the second attempt', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(okResponse([MOCK_PRESET]));

    const storage = new ApiPresetStorage('/api');
    const result = await storage.loadAllPresets();

    expect(result).toEqual([MOCK_PRESET]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after two consecutive network failures', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error('Network error'));

    const storage = new ApiPresetStorage('/api');
    await expect(storage.loadAllPresets()).rejects.toThrow('Network error');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after two consecutive non-OK HTTP responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(errResponse(503, 'Service Unavailable'));

    const storage = new ApiPresetStorage('/api');
    await expect(storage.loadAllPresets()).rejects.toThrow('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once on a non-OK response and resolves on the second attempt', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(errResponse(500))
      .mockResolvedValueOnce(okResponse([MOCK_PRESET]));

    const storage = new ApiPresetStorage('/api');
    const result = await storage.loadAllPresets();

    expect(result).toEqual([MOCK_PRESET]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
