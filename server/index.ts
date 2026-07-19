/**
 * server/index.ts — R3 NATIVE EQ API server
 * Endpoints: GET/POST/DELETE /api/presets
 */

import express from 'express';
import cors from 'cors';
import type { EQPreset } from '../src/dsp/types/index.js';
import { query } from './db.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPreset(row: Record<string, any>): EQPreset {
  return {
    id:          row.id,
    name:        row.name,
    category:    row.category,
    description: row.description,
    tags:        Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags ?? '[]'),
    state:       typeof row.state === 'object' ? row.state : JSON.parse(row.state ?? '{}'),
    isFactory:   row.is_factory,
    createdAt:   Number(row.created_at),
    updatedAt:   Number(row.updated_at),
  };
}

const app  = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'r3-native-eq-api', ts: Date.now() });
});

// ── GET /api/presets — all user presets ───────────────────────────────────────
app.get('/api/presets', async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, name, category, description, tags, state,
              is_factory, created_at, updated_at
       FROM presets
       WHERE is_factory = false
       ORDER BY updated_at DESC`
    );
    const presets = result.rows.map(rowToPreset);
    res.json(presets);
  } catch (err) {
    console.error('[GET /api/presets]', err);
    res.status(500).json({ error: 'Failed to load presets' });
  }
});

// ── POST /api/presets — upsert a preset ───────────────────────────────────────
app.post('/api/presets', async (req, res) => {
  const p = req.body;

  // Basic guard — full validation lives in the DSP layer
  if (!p || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string') {
    return res.status(400).json({ error: 'id and name are required' });
  }
  if (p.isFactory) {
    return res.status(400).json({ error: 'Cannot persist factory presets via API' });
  }

  try {
    await query(
      `INSERT INTO presets
         (id, name, category, description, tags, state, is_factory, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,false,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         name        = EXCLUDED.name,
         category    = EXCLUDED.category,
         description = EXCLUDED.description,
         tags        = EXCLUDED.tags,
         state       = EXCLUDED.state,
         updated_at  = EXCLUDED.updated_at`,
      [
        p.id,
        String(p.name).slice(0, 100),
        String(p.category || 'Custom'),
        String(p.description || '').slice(0, 500),
        JSON.stringify(Array.isArray(p.tags) ? p.tags.slice(0, 20) : []),
        JSON.stringify(p.state),
        Number(p.createdAt) || Date.now(),
        Date.now(),
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/presets]', err);
    res.status(500).json({ error: 'Failed to save preset' });
  }
});

// ── DELETE /api/presets/:id ───────────────────────────────────────────────────
app.delete('/api/presets/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || !/^[a-z0-9-]+$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid preset id' });
  }
  try {
    const result = await query(
      `DELETE FROM presets WHERE id = $1 AND is_factory = false`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Preset not found or is factory' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/presets/:id]', err);
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[r3-api] listening on port ${PORT}`);
});
