/**
 * Data Types - Type definitions for the Data Type Extractor feature.
 *
 * Extracts structured data types from images via OCR.
 * Column headers become attribute names, rows become example instances.
 */

/**
 * A single extraction from an image.
 */
export interface Extraction {
  readonly id: string;
  readonly timestamp: number;
  readonly imageDataUrl: string;  // Base64 of region
  readonly rawOcrText: string;
  readonly rows: Record<string, string>[];  // Parsed row data
}

/**
 * A named data type with attributes and example instances.
 */
export interface DataType {
  readonly id: string;
  readonly name: string;
  readonly attributes: readonly string[];           // Column/field names
  readonly examples: readonly Record<string, string>[];  // Row instances
  readonly extractions: readonly Extraction[];      // History for reference
}

/**
 * Crop rectangle for selecting a region of an image.
 */
export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * An uploaded image with its crop state.
 */
export interface UploadedImage {
  readonly id: string;
  readonly dataUrl: string;
  readonly cropRect: CropRect | null;
}

/**
 * State for the Data Types modal.
 */
export interface DataTypesState {
  readonly types: readonly DataType[];
  readonly selectedTypeId: string | null;
  readonly images: readonly UploadedImage[];
  readonly currentImageIndex: number;
  readonly isExtracting: boolean;
  readonly lastOcrText: string | null;
  readonly pendingExtraction: PendingExtraction | null;  // Awaiting user confirmation
}

/**
 * Parsed table data awaiting user confirmation.
 */
export interface PendingExtraction {
  readonly headers: readonly string[];
  readonly rows: readonly Record<string, string>[];
  readonly imageDataUrl: string;
  readonly rawOcrText: string;
}

/**
 * Export format for data types JSON.
 */
export interface DataTypeExport {
  attributes: string[];
  examples: Record<string, string>[];
}

export type DataTypesExport = Record<string, DataTypeExport>;
