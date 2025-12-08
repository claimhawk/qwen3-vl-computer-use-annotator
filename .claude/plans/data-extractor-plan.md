# Data Type Extractor Plan

## Overview

Create a "Data Types" panel where users can:
1. Create named data types (e.g., "procedures", "providers", "claims")
2. Upload images, crop regions, run OCR
3. Extract text values into the data type
4. Add more images to refine/expand the data
5. Export as JSON for generator configs

## Key Concept

Each **Data Type** stores:
- Original extracted values (immutable source of truth)
- Processed/mutated values (for generation use)

## UI Flow

1. Click "Data Types" button in toolbar → Opens modal
2. Click "+ New Type" → Enter name (e.g., "provider_names")
3. Modal shows the type editor:
   - Upload Image button
   - Image preview with crop tool
   - Extract button (runs OCR)
   - Extracted values list
   - Raw OCR text view
4. Can upload more images, extract more → values accumulate
5. Export all types as JSON

## Modal Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Data Types                                             [X]  │
├──────────────┬──────────────────────────────────────────────┤
│ Types        │  provider_names                              │
│ ─────────────│  ──────────────────────────────────────────  │
│ + New Type   │                                              │
│              │  [Upload Image]                              │
│ ● providers  │  ┌────────────────────────────────────────┐  │
│ ○ codes      │  │                                        │  │
│ ○ statuses   │  │     (Image preview with crop rect)     │  │
│              │  │                                        │  │
│              │  └────────────────────────────────────────┘  │
│              │  [Extract]                                   │
│              │                                              │
│              │  Extracted Values (24 unique):               │
│              │  ┌────────────────────────────────────────┐  │
│              │  │ Dr. Cheng                              │  │
│              │  │ Dr. Patel                              │  │
│              │  │ Dr. Jackson                            │  │
│              │  │ ...                                    │  │
│              │  └────────────────────────────────────────┘  │
│              │                                              │
│              │  Raw OCR:                                    │
│              │  ┌────────────────────────────────────────┐  │
│              │  │ Dr. Cheng | D0145 | 54.58 | ...        │  │
│              │  │ Dr. Patel | D1120 | 38.75 | ...        │  │
│              │  └────────────────────────────────────────┘  │
├──────────────┴──────────────────────────────────────────────┤
│                           [Export JSON]  [Clear All]        │
└─────────────────────────────────────────────────────────────┘
```

## Data Structures

```typescript
interface DataType {
  id: string;
  name: string;                    // e.g., "provider_names"
  originalValues: string[];        // Raw extracted values (immutable)
  processedValues: string[];       // Edited/filtered values for export
  extractions: Extraction[];       // History of extractions
}

interface Extraction {
  id: string;
  imageUrl: string;
  cropBbox: BBox;
  rawOcrText: string;
  extractedValues: string[];
  timestamp: number;
}

interface DataTypesState {
  types: DataType[];
  selectedTypeId: string | null;
  currentImage: string | null;
  cropBbox: BBox | null;
}
```

## Implementation

### New Files

1. `src/components/DataTypesModal.tsx` - Main modal component
2. `src/hooks/useDataTypes.ts` - State management
3. `src/types/dataTypes.ts` - Type definitions

### Changes to Existing Files

1. `src/app/page.tsx` - Add "Data Types" button, modal state

### Value Extraction Logic

From OCR text, extract values by:
1. Split by newlines → rows
2. Split by common delimiters (|, tab, multiple spaces) → columns
3. User selects which "column" of data they want for this type
4. Or: simple mode - just split by newlines, treat each line as a value

## Steps

1. Create type definitions
2. Create modal skeleton with open/close
3. Add toolbar button to page.tsx
4. Implement types list (left sidebar in modal)
5. Implement image upload + preview
6. Implement crop rectangle drawing
7. Wire up OCR (reuse chandraService)
8. Implement value extraction from OCR text
9. Implement value accumulation (deduped)
10. Implement JSON export
11. Add delete/edit capabilities

## Export Format

```json
{
  "dataTypes": {
    "provider_names": {
      "original": ["Dr. Cheng", "Dr. Patel", ...],
      "values": ["Dr. Cheng", "Dr. Patel", ...]
    },
    "procedure_codes": {
      "original": ["D0145", "D0603", ...],
      "values": ["D0145", "D0603", ...]
    }
  }
}
```
