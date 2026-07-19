/**
 * useKeyboardShortcuts — global keyboard handler for the EQ
 *
 * Tab / Shift+Tab   cycle through bands
 * ← / →            nudge frequency (×1.05 / ÷1.05; hold Shift for ×1.3)
 * ↑ / ↓            nudge gain ±0.5 dB (hold Shift for ±3 dB)
 * Ctrl+Z            undo
 * Ctrl+Y            redo  (also Ctrl+Shift+Z)
 * E                 toggle band enabled
 * B                 toggle bypass
 * ?                 toggle shortcut help
 */

import { useEffect } from 'react';
import type { EQBand } from '../dsp';

interface Params {
  bands: readonly EQBand[];
  selectedBand: number;
  setSelectedBand: (n: number) => void;
  updateBand: (id: number, u: Partial<EQBand>) => void;
  toggleBypass: () => void;
  undo: () => void;
  redo: () => void;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useKeyboardShortcuts({
  bands, selectedBand, setSelectedBand, updateBand, toggleBypass, undo, redo, setShowHelp,
}: Params) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      // Don't intercept inside inputs/selects
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;

      const band = bands.find(b => b.id === selectedBand);
      const count = bands.length;

      // Ctrl / Meta shortcuts first
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          redo();
        }
        return;
      }

      switch (e.key) {
        case 'Tab': {
          e.preventDefault();
          const next = e.shiftKey
            ? (selectedBand - 1 + count) % count
            : (selectedBand + 1) % count;
          setSelectedBand(next);
          break;
        }
        case 'ArrowRight': {
          if (!band) break;
          e.preventDefault();
          const factor = e.shiftKey ? 1.3 : 1.05;
          updateBand(band.id, { frequency: Math.min(20000, band.frequency * factor) });
          break;
        }
        case 'ArrowLeft': {
          if (!band) break;
          e.preventDefault();
          const factor = e.shiftKey ? 1.3 : 1.05;
          updateBand(band.id, { frequency: Math.max(20, band.frequency / factor) });
          break;
        }
        case 'ArrowUp': {
          if (!band) break;
          e.preventDefault();
          const step = e.shiftKey ? 3 : 0.5;
          updateBand(band.id, { gain: Math.min(24, band.gain + step) });
          break;
        }
        case 'ArrowDown': {
          if (!band) break;
          e.preventDefault();
          const step = e.shiftKey ? 3 : 0.5;
          updateBand(band.id, { gain: Math.max(-24, band.gain - step) });
          break;
        }
        case 'e':
        case 'E':
          if (band) updateBand(band.id, { enabled: !band.enabled });
          break;
        case 'b':
        case 'B':
          toggleBypass();
          break;
        case '?':
          setShowHelp(v => !v);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bands, selectedBand, setSelectedBand, updateBand, toggleBypass, undo, redo, setShowHelp]);
}
