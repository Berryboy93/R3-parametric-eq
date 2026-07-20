/**
 * PresetBrowser — full modal preset management
 * FR-PR-001 to FR-PR-012: search, filter by category, save, delete, import/export
 */

import { useState, useRef, useCallback } from 'react';
import type { EQPreset, EQState } from '../dsp';

interface Props {
  factoryPresets: EQPreset[];
  userPresets: EQPreset[];
  currentState: EQState;
  onLoad: (preset: EQPreset) => void;
  onSave: (name: string, state: EQState, category: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onImport: (json: string) => Promise<{ preset: EQPreset | null; errors: string[] }>;
  onClose: () => void;
  /** Dismissible banner shown when the preset list could not be loaded */
  loadError?: string | null;
  /** Inline error shown when a save or delete operation fails */
  saveError?: string | null;
  onDismissLoadError?: () => void;
  onDismissSaveError?: () => void;
  onRetryLoad?: () => void;
}

const CATEGORY_ORDER = ['All', 'Reference', 'Vocal', 'Voice', 'Music', 'Mastering', 'Instrument', 'Custom'];

export function PresetBrowser({
  factoryPresets, userPresets, currentState,
  onLoad, onSave, onDelete, onExport, onImport, onClose,
  loadError, saveError, onDismissLoadError, onDismissSaveError, onRetryLoad,
}: Props) {
  const [search,       setSearch]       = useState('');
  const [category,     setCategory]     = useState('All');
  const [saveOpen,     setSaveOpen]     = useState(false);
  const [saveName,     setSaveName]     = useState('');
  const [saveCat,      setSaveCat]      = useState('Custom');
  const [importError,  setImportError]  = useState<string | null>(null);
  const [importOk,     setImportOk]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const all = [...factoryPresets, ...userPresets];

  // Compute available categories from current presets
  const cats = ['All', ...CATEGORY_ORDER.slice(1).filter(c =>
    all.some(p => p.category === c)
  ), ...Array.from(new Set(all.map(p => p.category))).filter(
    c => !CATEGORY_ORDER.includes(c)
  )];
  const uniqueCats = Array.from(new Set(cats));

  const q = search.toLowerCase();
  const visible = all.filter(p => {
    const catOk = category === 'All' || p.category === category;
    const searchOk = !q || p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q));
    return catOk && searchOk;
  });

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim(), currentState, saveCat);
    setSaveOpen(false);
    setSaveName('');
    setCategory('Custom');
  };

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const text = ev.target?.result as string;
      const result = await onImport(text);
      if (result.preset) {
        setImportOk(true);
        setImportError(null);
        setTimeout(() => setImportOk(false), 3000);
      } else {
        setImportError(result.errors.join(', '));
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }, [onImport]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 860, maxHeight: '90vh',
          background: '#0d0d18', border: '1px solid #252538',
          borderRadius: 12, display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
        }}
      >
        {/* ── Load-error banner ─────────────────────────────────────────── */}
        {loadError && (
          <div style={{
            padding: '10px 20px', background: 'rgba(239,68,68,0.10)',
            borderBottom: '1px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: '#ef4444', flex: 1 }}>⚠ {loadError}</span>
            {onRetryLoad && (
              <button
                onClick={onRetryLoad}
                title="Retry loading presets"
                style={{
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.40)',
                  color: '#ef4444', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  cursor: 'pointer', padding: '3px 9px', borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >RETRY</button>
            )}
            <button
              onClick={onDismissLoadError}
              title="Dismiss"
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', padding: '0 2px', opacity: 0.7 }}
            >✕</button>
          </div>
        )}

        {/* ── Modal header ──────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #1a1a2e',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#00D4FF', letterSpacing: '0.14em', fontFamily: 'Bebas Neue, Montserrat, sans-serif' }}>
            PRESET BROWSER
          </span>
          <span style={{ fontSize: 10, color: '#404055', marginLeft: 2 }}>
            {visible.length} / {all.length} presets
          </span>
          <div style={{ flex: 1 }} />

          {/* Import */}
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
          {importError && (
            <span style={{ fontSize: 10, color: '#ef4444', maxWidth: 200 }}>{importError}</span>
          )}
          {importOk && (
            <span style={{ fontSize: 10, color: '#00D4FF' }}>✓ Imported</span>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            title="Import preset from JSON file"
            style={btnStyle('ghost')}
          >↑ IMPORT</button>

          {/* Save current */}
          <button
            onClick={() => setSaveOpen(v => !v)}
            title="Save current EQ as a new preset"
            style={btnStyle(saveOpen ? 'accent' : 'ghost')}
          >+ SAVE CURRENT</button>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#505065', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>

        {/* ── Save-error banner ─────────────────────────────────────────── */}
        {saveError && (
          <div style={{
            padding: '8px 20px', background: 'rgba(239,68,68,0.10)',
            borderBottom: '1px solid rgba(239,68,68,0.20)',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: '#ef4444', flex: 1 }}>⚠ {saveError}</span>
            <button
              onClick={onDismissSaveError}
              title="Dismiss"
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', padding: '0 2px', opacity: 0.7 }}
            >✕</button>
          </div>
        )}

        {/* ── Save dialog ───────────────────────────────────────────────── */}
        {saveOpen && (
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid #1a1a2e',
            background: '#0b0b14', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
          }}>
            <input
              autoFocus
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaveOpen(false); }}
              placeholder="Preset name…"
              maxLength={100}
              style={inputStyle}
            />
            <select
              value={saveCat}
              onChange={e => setSaveCat(e.target.value)}
              style={{ ...inputStyle, width: 130 }}
            >
              {['Custom', 'Vocal', 'Voice', 'Music', 'Mastering', 'Instrument', 'Reference'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button onClick={handleSave} disabled={!saveName.trim()} style={btnStyle('accent')}>SAVE</button>
            <button onClick={() => setSaveOpen(false)} style={btnStyle('ghost')}>CANCEL</button>
          </div>
        )}

        {/* ── Search + category ─────────────────────────────────────────── */}
        <div style={{
          padding: '10px 20px 0', borderBottom: '1px solid #1a1a2e',
          display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
        }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search presets…"
            style={{ ...inputStyle, width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 10 }}>
            {uniqueCats.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={{
                  padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', whiteSpace: 'nowrap',
                  border: `1px solid ${category === c ? '#00D4FF60' : '#252535'}`,
                  background: category === c ? 'rgba(183,255,0,0.1)' : 'transparent',
                  color: category === c ? '#00D4FF' : '#505065',
                  transition: 'all 120ms',
                }}
              >{c.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {/* ── Preset list ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {visible.length === 0 ? (
            <p style={{ fontSize: 12, color: '#404055', textAlign: 'center', marginTop: 40, fontStyle: 'italic' }}>
              No presets match your search.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {visible.map(p => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  confirmingDelete={deleteConfirm === p.id}
                  onLoad={() => { onLoad(p); onClose(); }}
                  onExport={() => onExport(p.id)}
                  onDelete={p.isFactory ? undefined : () => setDeleteConfirm(p.id)}
                  onDeleteConfirm={() => { onDelete(p.id); setDeleteConfirm(null); }}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PresetCard ────────────────────────────────────────────────────────────────

function PresetCard({
  preset, confirmingDelete, onLoad, onExport, onDelete, onDeleteConfirm, onDeleteCancel,
}: {
  preset: EQPreset;
  confirmingDelete: boolean;
  onLoad: () => void;
  onExport: () => void;
  onDelete?: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  return (
    <div style={{
      background: '#0b0b14', border: '1px solid #1e1e2e',
      borderRadius: 8, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'border-color 150ms',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#30304a')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e2e')}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#d0d0e8', lineHeight: 1.3 }}>
          {preset.name}
        </span>
        {preset.isFactory && (
          <span style={{
            fontSize: 8, fontWeight: 800, color: '#00D4FF', letterSpacing: '0.08em',
            border: '1px solid #00D4FF40', borderRadius: 3, padding: '1px 5px', flexShrink: 0,
          }}>FACTORY</span>
        )}
      </div>

      {/* Category */}
      <span style={{ fontSize: 9, color: '#505065', letterSpacing: '0.08em' }}>
        {preset.category.toUpperCase()}
      </span>

      {/* Description */}
      {preset.description && (
        <p style={{
          fontSize: 11, color: '#484860', lineHeight: 1.5, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {preset.description}
        </p>
      )}

      {/* Tags */}
      {preset.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {preset.tags.slice(0, 4).map(t => (
            <span key={t} style={{
              fontSize: 9, color: '#404055', background: '#13131e',
              border: '1px solid #1e1e2e', borderRadius: 3, padding: '1px 6px',
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      {confirmingDelete ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: '#ef4444', flex: 1, alignSelf: 'center' }}>Delete preset?</span>
          <button onClick={onDeleteConfirm} style={btnStyle('danger')}>DELETE</button>
          <button onClick={onDeleteCancel} style={btnStyle('ghost')}>CANCEL</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <button onClick={onLoad} style={{ ...btnStyle('accent'), flex: 1 }}>LOAD</button>
          <button onClick={onExport} title="Export as JSON" style={btnStyle('ghost')}>↓</button>
          {onDelete && (
            <button onClick={onDelete} title="Delete preset" style={btnStyle('ghost')}>✕</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: '#13131e', border: '1px solid #252535', borderRadius: 6,
  color: '#a0a0c0', fontSize: 11, padding: '6px 10px', outline: 'none',
  fontFamily: 'Montserrat, sans-serif',
};

function btnStyle(variant: 'accent' | 'ghost' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '5px 12px', borderRadius: 5, cursor: 'pointer',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    border: '1px solid', transition: 'all 120ms', whiteSpace: 'nowrap',
    fontFamily: 'Montserrat, sans-serif',
  };
  if (variant === 'accent') return { ...base, background: 'rgba(183,255,0,0.12)', borderColor: '#00D4FF60', color: '#00D4FF' };
  if (variant === 'danger') return { ...base, background: 'rgba(239,68,68,0.12)', borderColor: '#ef444460', color: '#ef4444' };
  return { ...base, background: 'transparent', borderColor: '#252535', color: '#606080' };
}
