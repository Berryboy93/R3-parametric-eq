/**
 * ApiPresetStorage — PresetStorage backed by the R3 NATIVE REST API.
 * Implements the same PresetStorage interface as LocalStoragePresetStorage
 * so the PresetManager requires no changes.
 *
 * Network failures are retried once before throwing so callers can surface
 * a clear error to the user instead of silently swallowing it.
 */

import type { EQPreset } from '../types/index';
import type { PresetStorage } from './preset-manager';

/** One automatic retry on network error or non-OK response, then throws. */
async function fetchWithRetry(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const attempt = () => fetch(input, init);
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const res = await attempt();
      if (res.ok) return res;
      // Non-OK response — surface the error text for retry/throw
      const body = await res.json().catch(() => ({}));
      lastErr = new Error(
        `HTTP ${res.status}: ${(body as { error?: string }).error ?? res.statusText}`
      );
      if (i === 0) continue; // retry once
    } catch (err) {
      lastErr = err;
      if (i === 0) continue; // retry once
    }
  }
  throw lastErr;
}

export class ApiPresetStorage implements PresetStorage {
  private readonly base: string;

  constructor(base = '/api') {
    this.base = base;
  }

  async savePreset(preset: EQPreset): Promise<void> {
    await fetchWithRetry(`${this.base}/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preset),
    });
  }

  async deletePreset(id: string): Promise<void> {
    await fetchWithRetry(`${this.base}/presets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async loadAllPresets(): Promise<EQPreset[]> {
    const res = await fetchWithRetry(`${this.base}/presets`);
    return (await res.json()) as EQPreset[];
  }
}
