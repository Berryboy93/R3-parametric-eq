/**
 * @r3/dsp
 * R3 NATIVE Digital Signal Processing Engine
 */

export type {
  EQBand,
  EQBandUpdate,
  EQState,
  EQStateUpdate,
  AnalyzerData,
  BiquadCoefficients,
  BiquadState,
  FrequencyResponse,
  FrequencyResponsePoint,
  EQPreset,
  PresetMetadata,
  AIRecommendation,
  AIAnalysisResult,
  AutomationPoint,
  AutomationTrack,
  AudioBuffer,
  ProcessingOptions,
  ValidationError,
  ValidationResult,
  UndoRedoState,
  PeakHoldData,
} from './types/index';

export {
  FilterType,
  ButterworthSlope,
  AnalyzerFFTSize,
  FrequencyIssue,
} from './types/index';

export {
  calculateBiquadCoefficients,
  processSampleBiquad,
  processBlockBiquad,
  validateCoefficients,
  resetFilterState,
  getMagnitudeResponse,
  getPhaseResponse,
  createDefaultBand,
  cloneBand,
  validateFrequency,
  validateGain,
  validateQ,
  validateBand,
  setBandFrequency,
  setBandGain,
  setBandQ,
  setBandEnabled,
  resetBand,
  updateBand,
  getSuggestedFrequencyRange,
  getFilterTypeName,
  getFilterTypeFullName,
  getSuggestedQRange,
  ParametricEQEngine,
  createParametricEQ,
} from './filters/index';

export {
  FFTAnalyzer,
  StereoAnalyzer,
  createBlackmanHarrisWindow,
  createHannWindow,
  createHammingWindow,
} from './analyzer/fft-analyzer';

export {
  PresetManager,
  LocalStoragePresetStorage,
  validatePreset,
  createFactoryPresets,
} from './presets/preset-manager';

export type { PresetStorage } from './presets/preset-manager';

export { AIEQAnalyzer, createAIAnalyzer } from './ai/ai-analyzer';

export const VERSION = '1.0.0';
