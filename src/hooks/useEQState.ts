/**
 * useEQState — React hook for EQ state with undo/redo
 */

import { useReducer, useCallback, useMemo, useState } from 'react';
import type { EQState, EQBandUpdate, UndoRedoState } from '../dsp';
import { createParametricEQ } from '../dsp';

interface EQStateAction {
  type:
    | 'SET_STATE' | 'UPDATE_BAND' | 'SET_INPUT_GAIN' | 'SET_OUTPUT_GAIN'
    | 'TOGGLE_BYPASS' | 'TOGGLE_ANALYZER' | 'SET_LINEAR_PHASE'
    | 'SET_OVERSAMPLING' | 'SET_AUTO_GAIN' | 'RESET' | 'UNDO' | 'REDO';
  payload?: unknown;
}

function eqStateReducer(state: UndoRedoState, action: EQStateAction): UndoRedoState {
  const { past, present, future } = state;

  switch (action.type) {
    case 'SET_STATE': {
      return { past: [...past, present], present: action.payload as EQState, future: [] };
    }
    case 'UPDATE_BAND': {
      const { bandId, updates } = action.payload as { bandId: number; updates: Partial<EQBandUpdate> };
      const newBands = present.bands.map(band =>
        band.id === bandId ? { ...band, ...updates } : band
      );
      return { past: [...past, present], present: { ...present, bands: newBands as any }, future: [] };
    }
    case 'SET_INPUT_GAIN':
      return { past: [...past, present], present: { ...present, inputGain: action.payload as number }, future: [] };
    case 'SET_OUTPUT_GAIN':
      return { past: [...past, present], present: { ...present, outputGain: action.payload as number }, future: [] };
    case 'TOGGLE_BYPASS':
      return { past: [...past, present], present: { ...present, bypass: !present.bypass }, future: [] };
    case 'TOGGLE_ANALYZER':
      return { past: [...past, present], present: { ...present, analyzerEnabled: !present.analyzerEnabled }, future: [] };
    case 'SET_LINEAR_PHASE':
      return { past: [...past, present], present: { ...present, linearPhase: action.payload as boolean }, future: [] };
    case 'SET_OVERSAMPLING':
      return { past: [...past, present], present: { ...present, oversampling: action.payload as boolean }, future: [] };
    case 'SET_AUTO_GAIN':
      return { past: [...past, present], present: { ...present, autoGain: action.payload as boolean }, future: [] };
    case 'RESET': {
      const engine = createParametricEQ();
      return { past: [...past, present], present: engine.getState(), future: [] };
    }
    case 'UNDO':
      if (past.length === 0) return state;
      return { past: past.slice(0, -1), present: past[past.length - 1], future: [present, ...future] };
    case 'REDO':
      if (future.length === 0) return state;
      return { past: [...past, present], present: future[0], future: future.slice(1) };
    default:
      return state;
  }
}

export function useEQState(initialState?: EQState) {
  const engine = useMemo(() => createParametricEQ(), []);
  const defaultState = initialState ?? engine.getState();

  const [undoRedoState, dispatch] = useReducer(eqStateReducer, {
    past: [],
    present: defaultState,
    future: [],
  });

  const state = undoRedoState.present;

  // ── A/B comparison slots ───────────────────────────────────────────────────
  const [abSlots, setAbSlots] = useState<{ A: EQState; B: EQState }>({
    A: defaultState,
    B: defaultState,
  });
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');

  /** Save the current state into the given slot and mark it active. */
  const captureToSlot = useCallback(
    (slot: 'A' | 'B') => {
      setAbSlots(prev => ({ ...prev, [slot]: state }));
      setActiveSlot(slot);
    },
    [state]
  );

  /**
   * Auto-save current state into the active slot, then switch to the other
   * slot and load its state. Adds to undo history so you can undo the switch.
   */
  const toggleAB = useCallback(() => {
    const next: 'A' | 'B' = activeSlot === 'A' ? 'B' : 'A';
    // Save current work to the active slot before switching
    setAbSlots(prev => {
      const updated = { ...prev, [activeSlot]: state };
      dispatch({ type: 'SET_STATE', payload: updated[next] });
      return updated;
    });
    setActiveSlot(next);
  }, [state, activeSlot]);

  const setState = useCallback((newState: EQState) => dispatch({ type: 'SET_STATE', payload: newState }), []);
  const updateBand = useCallback((bandId: number, updates: Partial<EQBandUpdate>) => dispatch({ type: 'UPDATE_BAND', payload: { bandId, updates } }), []);
  const setInputGain = useCallback((gain: number) => dispatch({ type: 'SET_INPUT_GAIN', payload: gain }), []);
  const setOutputGain = useCallback((gain: number) => dispatch({ type: 'SET_OUTPUT_GAIN', payload: gain }), []);
  const toggleBypass = useCallback(() => dispatch({ type: 'TOGGLE_BYPASS' }), []);
  const toggleAnalyzer = useCallback(() => dispatch({ type: 'TOGGLE_ANALYZER' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const canUndo = undoRedoState.past.length > 0;
  const canRedo = undoRedoState.future.length > 0;

  return {
    state, setState, updateBand, setInputGain, setOutputGain,
    toggleBypass, toggleAnalyzer, reset, undo, redo, canUndo, canRedo, engine,
    abSlots, activeSlot, captureToSlot, toggleAB,
  };
}
