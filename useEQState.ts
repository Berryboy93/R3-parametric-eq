/**
 * @r3/ui/hooks/useEQState
 * React hook for managing EQ state with undo/redo
 */

import { useReducer, useCallback, useMemo } from 'react';
import type { EQState, EQBandUpdate, UndoRedoState } from '@r3/dsp';
import { createParametricEQ } from '@r3/dsp';

// ============================================================================
// Types
// ============================================================================

interface EQStateAction {
  type:
    | 'SET_STATE'
    | 'UPDATE_BAND'
    | 'SET_INPUT_GAIN'
    | 'SET_OUTPUT_GAIN'
    | 'TOGGLE_BYPASS'
    | 'TOGGLE_ANALYZER'
    | 'SET_LINEAR_PHASE'
    | 'SET_OVERSAMPLING'
    | 'SET_AUTO_GAIN'
    | 'RESET'
    | 'UNDO'
    | 'REDO';
  payload?: unknown;
}

// ============================================================================
// Reducer
// ============================================================================

function eqStateReducer(state: UndoRedoState, action: EQStateAction): UndoRedoState {
  const { past, present, future } = state;

  switch (action.type) {
    case 'SET_STATE': {
      const newState = action.payload as EQState;
      return {
        past: [...past, present],
        present: newState,
        future: [],
      };
    }

    case 'UPDATE_BAND': {
      const { bandId, updates } = action.payload as {
        bandId: number;
        updates: Partial<EQBandUpdate>;
      };

      const newBands = present.bands.map((band) => {
        if (band.id === bandId) {
          return { ...band, ...updates };
        }
        return band;
      });

      const newState: EQState = {
        ...present,
        bands: newBands as any,
      };

      return {
        past: [...past, present],
        present: newState,
        future: [],
      };
    }

    case 'SET_INPUT_GAIN': {
      const gain = action.payload as number;
      const newState: EQState = { ...present, inputGain: gain };
      return { past: [...past, present], present: newState, future: [] };
    }

    case 'SET_OUTPUT_GAIN': {
      const gain = action.payload as number;
      const newState: EQState = { ...present, outputGain: gain };
      return { past: [...past, present], present: newState, future: [] };
    }

    case 'TOGGLE_BYPASS': {
      const newState: EQState = { ...present, bypass: !present.bypass };
      return { past: [...past, present], present: newState, future: [] };
    }

    case 'TOGGLE_ANALYZER': {
      const newState: EQState = { ...present, analyzerEnabled: !present.analyzerEnabled };
      return { past: [...past, present], present: newState, future: [] };
    }

    case 'SET_LINEAR_PHASE': {
      const linearPhase = action.payload as boolean;
      const newState: EQState = { ...present, linearPhase };
      return { past: [...past, present], present: newState, future: [] };
    }

    case 'SET_OVERSAMPLING': {
      const oversampling = action.payload as boolean;
      const newState: EQState = { ...present, oversampling };
      return { past: [...past, present], present: newState, future: [] };
    }

    case 'SET_AUTO_GAIN': {
      const autoGain = action.payload as boolean;
      const newState: EQState = { ...present, autoGain };
      return { past: [...past, present], present: newState, future: [] };
    }

    case 'RESET': {
      const engine = createParametricEQ();
      return {
        past: [...past, present],
        present: engine.getState(),
        future: [],
      };
    }

    case 'UNDO': {
      if (past.length === 0) return state;
      const newPast = past.slice(0, -1);
      const newPresent = past[past.length - 1];
      const newFuture = [present, ...future];
      return { past: newPast, present: newPresent, future: newFuture };
    }

    case 'REDO': {
      if (future.length === 0) return state;
      const newFuture = future.slice(1);
      const newPresent = future[0];
      const newPast = [...past, present];
      return { past: newPast, present: newPresent, future: newFuture };
    }

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useEQState(initialState?: EQState) {
  const engine = useMemo(() => createParametricEQ(), []);

  const defaultState = initialState ?? engine.getState();

  const [undoRedoState, dispatch] = useReducer(eqStateReducer, {
    past: [],
    present: defaultState,
    future: [],
  });

  const state = undoRedoState.present;

  // ========================================================================
  // Callbacks
  // ========================================================================

  const setState = useCallback((newState: EQState) => {
    dispatch({ type: 'SET_STATE', payload: newState });
  }, []);

  const updateBand = useCallback((bandId: number, updates: Partial<EQBandUpdate>) => {
    dispatch({ type: 'UPDATE_BAND', payload: { bandId, updates } });
  }, []);

  const setInputGain = useCallback((gain: number) => {
    dispatch({ type: 'SET_INPUT_GAIN', payload: gain });
  }, []);

  const setOutputGain = useCallback((gain: number) => {
    dispatch({ type: 'SET_OUTPUT_GAIN', payload: gain });
  }, []);

  const toggleBypass = useCallback(() => {
    dispatch({ type: 'TOGGLE_BYPASS' });
  }, []);

  const toggleAnalyzer = useCallback(() => {
    dispatch({ type: 'TOGGLE_ANALYZER' });
  }, []);

  const setLinearPhase = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_LINEAR_PHASE', payload: enabled });
  }, []);

  const setOversampling = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_OVERSAMPLING', payload: enabled });
  }, []);

  const setAutoGain = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_AUTO_GAIN', payload: enabled });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const canUndo = undoRedoState.past.length > 0;
  const canRedo = undoRedoState.future.length > 0;

  return {
    state,
    setState,
    updateBand,
    setInputGain,
    setOutputGain,
    toggleBypass,
    toggleAnalyzer,
    setLinearPhase,
    setOversampling,
    setAutoGain,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
    engine,
  };
}
