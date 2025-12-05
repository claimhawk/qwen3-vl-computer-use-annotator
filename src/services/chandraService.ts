/**
 * Chandra Service
 *
 * Handles communication with Chandra OCR (deployed on Modal)
 * to transcribe masked regions and understand what data generators are needed.
 */

import type { ClippedRegion } from "./exportService";

export interface TranscriptionResult {
  elementId: string;
  text: string;
  dataType: DataType;
  suggestedGenerator?: string;
  confidence: number;
}

export type DataType =
  | "name"           // Person names
  | "date"           // Dates in various formats
  | "time"           // Times
  | "datetime"       // Combined date and time
  | "currency"       // Money amounts
  | "number"         // Generic numbers
  | "phone"          // Phone numbers
  | "email"          // Email addresses
  | "address"        // Street addresses
  | "code"           // Codes, IDs, reference numbers
  | "status"         // Status indicators
  | "label"          // Static labels/headers
  | "text"           // Free-form text
  | "unknown";

const CHANDRA_URL = process.env.NEXT_PUBLIC_OCR_INFERENCE_URL || "https://claimhawk--chandra-ocr-inference-ocr-endpoint.modal.run";

/**
 * Transcribe a single masked region using Chandra OCR.
 */
export async function transcribeRegion(region: ClippedRegion): Promise<TranscriptionResult> {
  try {
    console.log(`[OCR] Sending request for ${region.elementId}, image size: ${region.imageBase64.length} chars`);

    const response = await fetch(CHANDRA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_base64: region.imageBase64,
        prompt_type: "ocr_layout",
        output_format: "markdown",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OCR] Failed for ${region.elementId}: ${response.status}`, errorText);
      return {
        elementId: region.elementId,
        text: "",
        dataType: "unknown",
        confidence: 0,
      };
    }

    const data = await response.json();
    console.log(`[OCR] Response for ${region.elementId}:`, JSON.stringify(data));
    const text = data.text || "";

    // Analyze the text to infer data type
    const { dataType, confidence } = inferDataType(text, region.elementType);

    return {
      elementId: region.elementId,
      text,
      dataType,
      suggestedGenerator: getSuggestedGenerator(dataType),
      confidence,
    };
  } catch (error) {
    console.error("Chandra transcription failed:", error);
    return {
      elementId: region.elementId,
      text: "",
      dataType: "unknown",
      confidence: 0,
    };
  }
}

/**
 * Transcribe multiple masked regions sequentially.
 * Processing one at a time to avoid CORS/rate-limiting issues with Modal endpoint.
 */
export async function transcribeRegions(
  regions: ClippedRegion[],
  onProgress?: (completed: number, total: number) => void
): Promise<TranscriptionResult[]> {
  const results: TranscriptionResult[] = [];

  // Process sequentially to avoid CORS/rate-limit issues
  for (let i = 0; i < regions.length; i++) {
    const result = await transcribeRegion(regions[i]);
    results.push(result);
    onProgress?.(i + 1, regions.length);
  }

  return results;
}

/**
 * Infer data type from transcribed text.
 */
function inferDataType(text: string, elementType: string): { dataType: DataType; confidence: number } {
  const trimmed = text.trim();

  if (!trimmed) {
    return { dataType: "unknown", confidence: 0 };
  }

  // Check for dates
  if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(trimmed) ||
      /\w+\s+\d{1,2},?\s+\d{4}/.test(trimmed) ||
      /\d{1,2}\s+\w+\s+\d{4}/.test(trimmed)) {
    return { dataType: "date", confidence: 0.9 };
  }

  // Check for times
  if (/\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?/.test(trimmed)) {
    return { dataType: "time", confidence: 0.9 };
  }

  // Check for currency
  if (/^\$[\d,]+\.?\d*$/.test(trimmed) ||
      /^[\d,]+\.?\d*\s*(?:USD|EUR|GBP)$/i.test(trimmed)) {
    return { dataType: "currency", confidence: 0.95 };
  }

  // Check for phone numbers
  if (/^\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}$/.test(trimmed) ||
      /^\+?\d{1,3}[\s\-\.]?\d{3}[\s\-\.]?\d{3}[\s\-\.]?\d{4}$/.test(trimmed)) {
    return { dataType: "phone", confidence: 0.9 };
  }

  // Check for email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { dataType: "email", confidence: 0.95 };
  }

  // Check for codes/IDs (alphanumeric patterns)
  if (/^[A-Z0-9\-]{4,20}$/i.test(trimmed) && /\d/.test(trimmed) && /[A-Z]/i.test(trimmed)) {
    return { dataType: "code", confidence: 0.7 };
  }

  // Check for pure numbers
  if (/^[\d,]+\.?\d*$/.test(trimmed)) {
    return { dataType: "number", confidence: 0.8 };
  }

  // Check for names (2-3 capitalized words)
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(trimmed)) {
    return { dataType: "name", confidence: 0.7 };
  }

  // Check for status words
  const statusWords = ["active", "pending", "complete", "completed", "cancelled", "canceled",
                       "scheduled", "confirmed", "approved", "rejected", "open", "closed"];
  if (statusWords.some(s => trimmed.toLowerCase().includes(s))) {
    return { dataType: "status", confidence: 0.8 };
  }

  // Default to text
  return { dataType: "text", confidence: 0.5 };
}

/**
 * Get suggested generator code for a data type.
 */
function getSuggestedGenerator(dataType: DataType): string {
  switch (dataType) {
    case "name":
      return "faker.name()";
    case "date":
      return 'random_date(rng, format="%m/%d/%Y")';
    case "time":
      return 'random_time(rng, format="%I:%M %p")';
    case "datetime":
      return 'random_datetime(rng)';
    case "currency":
      return "random_currency(rng, min=10, max=10000)";
    case "phone":
      return "faker.phone_number()";
    case "email":
      return "faker.email()";
    case "address":
      return "faker.address()";
    case "code":
      return "random_code(rng, length=8)";
    case "number":
      return "rng.randint(1, 1000)";
    case "status":
      return 'choose(rng, ["Active", "Pending", "Complete"])';
    default:
      return 'choose(rng, ["Item 1", "Item 2", "Item 3"])';
  }
}

export interface GeneratorSuggestion {
  elementId: string;
  generatorType: string;
  generatorCode: string;
  description: string;
}

/**
 * Analyze transcription results to suggest data generators.
 */
export function analyzeTranscriptions(results: TranscriptionResult[]): GeneratorSuggestion[] {
  const suggestions: GeneratorSuggestion[] = [];

  for (const result of results) {
    if (result.dataType === "unknown" || result.confidence < 0.5) continue;

    suggestions.push({
      elementId: result.elementId,
      generatorType: result.dataType,
      generatorCode: result.suggestedGenerator || "",
      description: `${result.dataType} field: "${result.text.substring(0, 30)}${result.text.length > 30 ? '...' : ''}"`,
    });
  }

  return suggestions;
}
