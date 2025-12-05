/**
 * Services for the Annotator application
 */

export {
  createExportZip,
  loadExportZip,
  loadAnnotationJson,
  clipMaskedRegions,
} from "./exportService";
export type { ExportOptions, LoadedAnnotation, ClippedRegion } from "./exportService";

export {
  checkServerHealth,
  generateProject,
  getGenerationProgress,
  imageUrlToBase64,
  canvasToBase64,
} from "./cudagService";
export type {
  GenerateOptions,
  GenerateResult,
  GenerationProgress,
  ServerHealth,
} from "./cudagService";

export {
  transcribeRegion,
  transcribeRegions,
  analyzeTranscriptions,
} from "./chandraService";
export type {
  TranscriptionResult,
  DataType,
  GeneratorSuggestion,
} from "./chandraService";
