# Annotator Heavy Refactor Implementation Plan

## Overview

This plan transforms the Annotator from a monolithic React application into a well-architected, maintainable codebase with integrated CUDAG project generation capabilities. The refactor follows SOLID principles, composition over inheritance, and convention over configuration.

**Branch:** `heavy-refactor`
**Base:** `main`

## Phase 1: Foundation - Custom Hooks Extraction

Extract state management from page.tsx into reusable custom hooks.

### 1.1 Create hooks/useAnnotationState.ts

```typescript
// Manages elements and tasks state
interface UseAnnotationStateReturn {
  elements: UIElement[];
  tasks: Task[];
  selectedElementId: string | null;
  selectedTaskId: string | null;
  addElement: (element: UIElement) => void;
  updateElement: (id: string, updates: Partial<UIElement>) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  selectTask: (id: string | null) => void;
  clearAll: () => void;
}
```

**Files to Create:**
- `src/hooks/useAnnotationState.ts`

**Lines Migrated:** ~100 lines from page.tsx

### 1.2 Create hooks/useImageState.ts

```typescript
// Manages image loading and state
interface UseImageStateReturn {
  imageUrl: string | null;
  imageSize: [number, number] | null;
  imagePath: string;
  screenName: string;
  setScreenName: (name: string) => void;
  loadImage: (file: File) => Promise<void>;
  setImageData: (url: string, size: [number, number], path: string) => void;
  clearImage: () => void;
}
```

**Files to Create:**
- `src/hooks/useImageState.ts`

**Lines Migrated:** ~50 lines from page.tsx

### 1.3 Create hooks/useToolState.ts

```typescript
// Manages tool selection state
interface UseToolStateReturn {
  currentType: ElementType;
  setCurrentType: (type: ElementType) => void;
  drawMode: 'single' | 'grid';
  setDrawMode: (mode: 'single' | 'grid') => void;
  gridRows: number;
  setGridRows: (rows: number) => void;
  gridCols: number;
  setGridCols: (cols: number) => void;
  isColorSampling: boolean;
  startColorSampling: () => void;
  stopColorSampling: () => void;
}
```

**Files to Create:**
- `src/hooks/useToolState.ts`

**Lines Migrated:** ~30 lines from page.tsx

### 1.4 Create hooks/useViewState.ts

```typescript
// Manages view/zoom/UI state
interface UseViewStateReturn {
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  elementsCollapsed: boolean;
  toggleElementsCollapsed: () => void;
  tasksCollapsed: boolean;
  toggleTasksCollapsed: () => void;
}
```

**Files to Create:**
- `src/hooks/useViewState.ts`

**Lines Migrated:** ~20 lines from page.tsx

### 1.5 Update page.tsx to Use Hooks

Refactor page.tsx to consume the new hooks:

```typescript
export default function Home() {
  const annotation = useAnnotationState();
  const image = useImageState();
  const tools = useToolState();
  const view = useViewState();
  // ... rest of component now much simpler
}
```

**Expected Result:**
- page.tsx reduced from 896 to ~400 lines
- State logic now testable independently
- Clear separation of concerns

---

## Phase 2: Service Layer Extraction

Extract business logic into service classes.

### 2.1 Create services/exportService.ts

Extract all ZIP creation/loading logic:

```typescript
export class ExportService {
  // Extract from downloadZip() - 258 lines
  static async createExportZip(
    annotation: Annotation,
    imageUrl: string,
    imageSize: [number, number]
  ): Promise<Blob>;

  // Extract from handleDrop() and loadAnnotation()
  static async loadExportZip(file: File): Promise<{
    annotation: Annotation;
    imageUrl: string;
  }>;

  // Extract masked image creation
  static async createMaskedImage(
    imageUrl: string,
    imageSize: [number, number],
    elements: UIElement[]
  ): Promise<Blob>;

  // Extract annotated image creation
  static async createAnnotatedImage(
    imageUrl: string,
    imageSize: [number, number],
    elements: UIElement[]
  ): Promise<Blob>;

  // Extract icon export logic
  static async exportIcons(
    imageUrl: string,
    elements: UIElement[]
  ): Promise<Map<string, Blob>>;
}
```

**Files to Create:**
- `src/services/exportService.ts`

**Lines Migrated:** ~300 lines from page.tsx

### 2.2 Create services/imageService.ts

Extract image manipulation logic:

```typescript
export class ImageService {
  static async loadImageFromFile(file: File): Promise<{
    url: string;
    size: [number, number];
  }>;

  static async cropImage(
    imageUrl: string,
    bbox: BBox
  ): Promise<{ url: string; size: [number, number] }>;

  static getImageContext(
    canvas: HTMLCanvasElement
  ): CanvasRenderingContext2D | null;

  static sampleColor(
    canvas: HTMLCanvasElement,
    x: number,
    y: number
  ): string;
}
```

**Files to Create:**
- `src/services/imageService.ts`

**Lines Migrated:** ~80 lines from page.tsx and AnnotationCanvas.tsx

### 2.3 Create services/coordinateService.ts

Extract coordinate transformation logic:

```typescript
export class CoordinateService {
  // Normalize pixel to RU (0-1000)
  static toRU(pixel: number, dimension: number): number;

  // Convert RU to pixel
  static fromRU(ru: number, dimension: number): number;

  // Screen to image coordinates
  static screenToImage(
    screenX: number,
    screenY: number,
    scale: number,
    offset: { x: number; y: number }
  ): { x: number; y: number };

  // Image to screen coordinates
  static imageToScreen(
    imageX: number,
    imageY: number,
    scale: number,
    offset: { x: number; y: number }
  ): { x: number; y: number };

  // Calculate element center
  static getElementCenter(element: UIElement): { x: number; y: number };

  // Calculate grid cell center
  static getGridCellCenter(
    element: UIElement,
    row: number,
    col: number
  ): { x: number; y: number };
}
```

**Files to Create:**
- `src/services/coordinateService.ts`

**Lines Migrated:** ~60 lines from AnnotationCanvas.tsx

---

## Phase 3: Utility Extraction

Extract shared utility functions.

### 3.1 Create utils/gridUtils.ts

Remove duplication between page.tsx and AnnotationCanvas.tsx:

```typescript
export interface GridPositions {
  colPositions: number[];
  rowPositions: number[];
  colBounds: number[];
  rowBounds: number[];
}

export function getGridPositions(element: UIElement): GridPositions;

export function getCellBounds(
  element: UIElement,
  row: number,
  col: number
): BBox;

export function getCellIndex(
  element: UIElement,
  x: number,
  y: number
): { row: number; col: number } | null;
```

**Files to Create:**
- `src/utils/gridUtils.ts`

**Duplication Removed:** 72 lines (36 x 2)

### 3.2 Create utils/toleranceUtils.ts

Extract tolerance calculation:

```typescript
export interface Tolerance {
  x: number;
  y: number;
}

export function calculateTolerance(
  element: UIElement,
  tolerancePercent?: number // default 0.7
): Tolerance;

export function addToleranceToElements(
  elements: UIElement[]
): UIElement[];
```

**Files to Create:**
- `src/utils/toleranceUtils.ts`

**Lines Extracted:** ~40 lines from downloadZip()

### 3.3 Create utils/elementTypeUtils.ts

Extract element type constants and helpers:

```typescript
export const MASKABLE_TYPES: readonly ElementType[] = [
  'textinput', 'dropdown', 'listbox', 'grid', 'icon',
  'panel', 'toolbar', 'menubar', 'text', 'mask'
];

export const PANEL_TYPES: readonly ElementType[] = [
  'panel', 'dialog', 'toolbar', 'menubar'
];

export const GRID_TYPES: readonly ElementType[] = [
  'grid', 'icon', 'dropdown', 'listbox'
];

export function isMaskable(type: ElementType): boolean;
export function isPanel(type: ElementType): boolean;
export function isGridType(type: ElementType): boolean;
export function getDefaultAction(type: ElementType): TaskAction;
```

**Files to Create:**
- `src/utils/elementTypeUtils.ts`

**Magic String Cleanup:** Replaces 8+ inline array checks

---

## Phase 4: Component Refactoring

Decompose large components into smaller, focused components.

### 4.1 Refactor AnnotationCanvas

Split into multiple components:

```
src/components/canvas/
├── AnnotationCanvas.tsx       (Container - ~100 lines)
├── CanvasRenderer.tsx         (Pure rendering - ~150 lines)
├── hooks/
│   ├── useCanvasTransform.ts  (Scale, offset, pan)
│   ├── useDrawing.ts          (Drawing state and handlers)
│   ├── useResize.ts           (Edge detection and resize)
│   └── useDividerDrag.ts      (Grid divider dragging)
└── overlays/
    ├── ElementOverlay.tsx     (Single element rendering)
    ├── GridOverlay.tsx        (Grid lines and numbers)
    └── DrawingOverlay.tsx     (Current drawing rect)
```

**Current:** 835 lines in one file
**Target:** ~100 lines per file, 8 files total

### 4.2 Refactor ElementList

Split into editor components:

```
src/components/elements/
├── ElementList.tsx            (Container - ~80 lines)
├── ElementItem.tsx            (Single list item - ~40 lines)
├── ElementEditor.tsx          (Editor container - ~60 lines)
└── editors/
    ├── BaseEditor.tsx         (Shared fields - ~50 lines)
    ├── GridEditor.tsx         (Rows/cols - ~40 lines)
    ├── MaskEditor.tsx         (Mask options - ~50 lines)
    ├── PanelEditor.tsx        (Layout options - ~60 lines)
    └── TextEditor.tsx         (Alignment - ~40 lines)
```

**Current:** 519 lines in one file
**Target:** ~50 lines per file, 8 files total

### 4.3 Refactor TaskList

Split into editor components:

```
src/components/tasks/
├── TaskList.tsx               (Container - ~80 lines)
├── TaskItem.tsx               (Single list item - ~40 lines)
├── TaskEditor.tsx             (Editor container - ~60 lines)
└── editors/
    ├── ActionSelector.tsx     (Action dropdown - ~50 lines)
    ├── TargetSelector.tsx     (Element target - ~40 lines)
    ├── TextInput.tsx          (Type/answer text - ~30 lines)
    ├── KeysInput.tsx          (Key combinations - ~40 lines)
    ├── ScrollInput.tsx        (Scroll pixels - ~30 lines)
    ├── WaitInput.tsx          (Wait time - ~30 lines)
    ├── DragInput.tsx          (Drag coordinates - ~50 lines)
    └── PriorStatesEditor.tsx  (Prior states - ~100 lines)
```

**Current:** 490 lines in one file
**Target:** ~50 lines per file, 11 files total

---

## Phase 5: CUDAG Integration

Add cudag-server communication and Generate button.

### 5.1 Create services/cudagService.ts

```typescript
export interface GenerateOptions {
  projectName: string;
  outputDir?: string;
  numSamples?: number;
  variations?: string[];
}

export interface GenerateResult {
  status: 'success' | 'error';
  projectPath?: string;
  filesCreated?: string[];
  error?: string;
}

export class CudagService {
  private static serverUrl = process.env.CUDAG_SERVER_URL || 'http://localhost:8000';

  static async checkHealth(): Promise<boolean>;

  static async generate(
    annotation: Annotation,
    originalImage: string,  // base64
    maskedImage?: string,   // base64
    icons?: Record<string, string>,  // name -> base64
    options: GenerateOptions
  ): Promise<GenerateResult>;

  static async getTemplates(): Promise<string[]>;
}
```

**Files to Create:**
- `src/services/cudagService.ts`

### 5.2 Create hooks/useCudagGeneration.ts

```typescript
export interface UseCudagGenerationReturn {
  isGenerating: boolean;
  progress: number;
  error: string | null;
  serverAvailable: boolean;
  generate: (options: GenerateOptions) => Promise<GenerateResult>;
  checkServer: () => Promise<void>;
}

export function useCudagGeneration(
  annotation: Annotation,
  imageUrl: string,
  imageSize: [number, number],
  elements: UIElement[]
): UseCudagGenerationReturn;
```

**Files to Create:**
- `src/hooks/useCudagGeneration.ts`

### 5.3 Create GenerateButton Component

```typescript
// src/components/GenerateButton.tsx
interface GenerateButtonProps {
  annotation: Annotation;
  imageUrl: string;
  imageSize: [number, number];
  elements: UIElement[];
  disabled?: boolean;
}

export function GenerateButton(props: GenerateButtonProps): JSX.Element;
```

Features:
- Server status indicator (green/red dot)
- Generate button (disabled if server unavailable)
- Options popover (project name, output dir, num samples)
- Progress indicator during generation
- Success/error toast notification

**Files to Create:**
- `src/components/GenerateButton.tsx`
- `src/components/GenerateOptionsModal.tsx`

### 5.4 Update Header with Generate Button

Add Generate button next to Download ZIP:

```tsx
<header className="flex items-center gap-4 ...">
  {/* ... existing content ... */}
  <div className="flex items-center gap-2">
    <ImportButton onLoad={loadAnnotation} />
    <DownloadButton onClick={downloadZip} disabled={elements.length === 0} />
    <GenerateButton
      annotation={annotation}
      imageUrl={imageUrl}
      imageSize={imageSize}
      elements={elements}
      disabled={elements.length === 0}
    />
  </div>
</header>
```

---

## Phase 6: cudag-server Implementation

Create FastAPI server in CUDAG project for handling generation requests.

### 6.1 Server Structure

```
cudag/
├── cudag/
│   └── server/
│       ├── __init__.py
│       ├── main.py           # FastAPI app
│       ├── routes/
│       │   ├── __init__.py
│       │   ├── health.py     # Health check endpoint
│       │   └── generate.py   # Generation endpoint
│       ├── services/
│       │   ├── __init__.py
│       │   ├── annotation_parser.py  # Parse annotation.json
│       │   ├── project_generator.py  # Generate CUDAG project
│       │   └── template_engine.py    # Jinja2 templates
│       └── templates/
│           ├── generator.py.j2
│           ├── screen.py.j2
│           ├── states.py.j2
│           └── tasks.py.j2
```

### 6.2 API Endpoints

```python
# GET /health
# Returns: {"status": "healthy", "version": "1.0.0"}

# POST /api/v1/generate
# Request body: GenerateRequest
# Returns: GenerateResponse

# GET /api/v1/templates
# Returns: ["basic", "grid", "workflow"]
```

### 6.3 CLI Command

Add `cudag serve` command:

```bash
cudag serve --port 8000 --reload
```

---

## Phase 7: Testing & Documentation

### 7.1 Unit Tests

```
src/__tests__/
├── hooks/
│   ├── useAnnotationState.test.ts
│   ├── useImageState.test.ts
│   └── useToolState.test.ts
├── services/
│   ├── exportService.test.ts
│   ├── imageService.test.ts
│   └── cudagService.test.ts
└── utils/
    ├── gridUtils.test.ts
    ├── toleranceUtils.test.ts
    └── coordinateService.test.ts
```

### 7.2 Integration Tests

```
src/__tests__/integration/
├── export.test.ts          # Full export flow
├── import.test.ts          # Full import flow
└── generate.test.ts        # CUDAG generation flow
```

### 7.3 Documentation

- JSDoc comments on all public functions
- README.md updates with architecture overview
- CONTRIBUTING.md with development guidelines
- Component storybook (optional)

---

## Implementation Order

### Week 1: Foundation
1. Phase 1.1-1.4: Create custom hooks
2. Phase 1.5: Update page.tsx to use hooks
3. Phase 3.1-3.3: Extract utilities

### Week 2: Services
4. Phase 2.1: Export service
5. Phase 2.2: Image service
6. Phase 2.3: Coordinate service

### Week 3: Components
7. Phase 4.1: Refactor AnnotationCanvas
8. Phase 4.2: Refactor ElementList
9. Phase 4.3: Refactor TaskList

### Week 4: CUDAG Integration
10. Phase 5.1-5.2: CUDAG service and hooks
11. Phase 5.3-5.4: Generate button UI
12. Phase 6.1-6.3: cudag-server implementation

### Week 5: Polish
13. Phase 7.1-7.2: Testing
14. Phase 7.3: Documentation
15. Code review and refinement

---

## File Changes Summary

### New Files to Create

**Hooks (4 files):**
- `src/hooks/useAnnotationState.ts`
- `src/hooks/useImageState.ts`
- `src/hooks/useToolState.ts`
- `src/hooks/useViewState.ts`

**Services (4 files):**
- `src/services/exportService.ts`
- `src/services/imageService.ts`
- `src/services/coordinateService.ts`
- `src/services/cudagService.ts`

**Utils (3 files):**
- `src/utils/gridUtils.ts`
- `src/utils/toleranceUtils.ts`
- `src/utils/elementTypeUtils.ts`

**Components (~25 files):**
- Canvas components (8 files)
- Element components (8 files)
- Task components (11 files)
- Generate components (2 files)

**Tests (~15 files)**

**Total New Files:** ~50 files

### Files to Modify

- `src/app/page.tsx` - Reduce from 896 to ~200 lines
- `src/components/AnnotationCanvas.tsx` - Replace with new structure
- `src/components/ElementList.tsx` - Replace with new structure
- `src/components/TaskList.tsx` - Replace with new structure

### Files to Delete

None - existing files will be replaced/refactored

---

## Success Metrics

1. **Line Count Reduction:**
   - page.tsx: 896 → ~200 lines (78% reduction)
   - AnnotationCanvas.tsx: 835 → ~100 lines per file
   - No file exceeds 150 lines

2. **Complexity Metrics:**
   - No function exceeds 50 lines
   - No component has more than 5 useState hooks
   - Cyclomatic complexity < 10 for all functions

3. **Code Quality:**
   - 0 duplicated code blocks
   - 100% TypeScript strict mode compliance
   - All public functions have JSDoc comments

4. **CUDAG Integration:**
   - Generate button functional
   - cudag-server running and accessible
   - Full annotation → project generation working

5. **Test Coverage:**
   - 80%+ coverage on hooks and services
   - Integration tests for critical flows

---

## Risk Mitigation

1. **Incremental Migration:** Each phase is independently deployable
2. **Feature Parity:** No functionality removed during refactor
3. **Backward Compatibility:** Export format unchanged
4. **Rollback Plan:** Each phase can be reverted independently

---

**Plan Created:** 2024-12-04
**Estimated Effort:** 5 weeks
**Priority:** High
