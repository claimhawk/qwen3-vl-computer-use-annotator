export type ElementType =
  | "button"
  | "textinput"
  | "label"
  | "listbox"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "grid"
  | "icon"
  | "menubar"
  | "toolbar"
  | "tab"
  | "scrollbar"
  | "titlebar"
  | "dialog"
  | "iconlist"
  | "text"
  | "mask"
  | "loading";

export interface BBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type IconListLayout = "sparse" | "stacked" | "random";
export type HAlign = "left" | "center" | "right";
export type VAlign = "top" | "center" | "bottom";

export interface IconDefinition {
  readonly elementId: string;   // Unique identifier (UUID) for tracking
  readonly centerX: number;     // Center X coordinate (relative to iconlist bbox)
  readonly centerY: number;     // Center Y coordinate (relative to iconlist bbox)
  readonly iconFileId?: string; // ID to map to icon image file (e.g., "od" → icon-tb-od.png)
  readonly label?: string;      // Text label displayed below icon (desktop icons only)
  readonly required?: boolean;  // Always include this icon even when varyN is on
}

export interface IconListOptions {
  readonly varyN?: boolean;  // Vary the number of icons shown (random subset)
}

export interface UIElement {
  readonly id: string;
  readonly type: ElementType;
  readonly bbox: BBox;
  readonly text?: string;
  readonly parentId?: string;
  readonly rows?: number;
  readonly cols?: number;
  readonly rowHeights?: readonly number[];  // Custom row heights as fractions (sum to 1)
  readonly colWidths?: readonly number[];   // Custom column widths as fractions (sum to 1)
  readonly mask?: boolean;
  readonly maskColor?: string;
  readonly layout?: IconListLayout;  // For iconlist: how child icons are arranged
  readonly randomOrder?: boolean; // For iconlist: randomize icon order
  readonly iconWidth?: number;    // For iconlist: width of each icon (from center click)
  readonly iconHeight?: number;   // For iconlist: height of each icon (from center click)
  readonly icons?: readonly IconDefinition[];  // For iconlist: detected icons with labels
  readonly varyN?: boolean;       // For iconlist: randomly vary number of icons shown
  readonly exportIcon?: boolean;  // For icons: include cropped image in export
  readonly hAlign?: HAlign;       // For text: horizontal alignment
  readonly vAlign?: VAlign;       // For text: vertical alignment
  readonly toleranceX?: number;   // Computed: 70% of element width (or cell width for grids)
  readonly toleranceY?: number;   // Computed: 70% of element height (or cell height for grids)
  readonly selectionColor?: string;   // For grids: color to simulate row selection
  readonly scrollable?: boolean;      // For grids: generate scroll tasks (top, bottom, page up/down)
  readonly selectableRow?: boolean;   // For grids: generate row selection tasks
  readonly selectableCell?: boolean;  // For grids: generate cell selection tasks
  readonly showGridLines?: boolean;   // For grids: draw grid lines on masked export
  readonly hideGridLines?: boolean;   // For grids: hide grid lines in live editor view
  readonly cellLabels?: readonly string[];  // For icon grids: label for each cell (indexed by row*cols+col)
  readonly ocr?: boolean;             // For grids/masks: run OCR and include transcription in export
  readonly transcription?: string;    // OCR result stored after export
  readonly loadingImage?: string;     // For loading: base64 data URL of spinner/loading image
  readonly waitTime?: number;         // For loading: seconds to wait (default 3)
}

// Actions are inferred from element type:
// - button, checkbox, radio, tab, menubar, toolbar, titlebar, scrollbar, dialog, panel, label → click
// - dropdown, listbox → click
// - textinput → click + type (two tool calls)
// - grid → click (on specific cell)

export interface ElementPriorState {
  readonly elementId: string;
  readonly filled?: boolean;         // For textinput: has text filled in
  readonly hasSelection?: boolean;   // For dropdown/listbox: has an item selected
  readonly open?: boolean;           // For dropdown/listbox: is expanded/open
  readonly checked?: boolean;        // For checkbox/radio: checked state
  readonly visible?: boolean;        // For panel/dialog: is visible on screen
}

export type TaskAction =
  | "key"           // Press a key or key combination
  | "type"          // Type text
  | "click_type"    // Click then type (2 tool calls: left_click + type)
  | "mouse_move"    // Move mouse to position
  | "left_click"    // Single left click
  | "left_click_drag" // Click and drag
  | "right_click"   // Right click (context menu)
  | "middle_click"  // Middle click
  | "double_click"  // Double left click
  | "triple_click"  // Triple left click (select line/paragraph)
  | "scroll"        // Vertical scroll
  | "hscroll"       // Horizontal scroll
  | "wait"          // Wait for loading/dialog
  | "terminate"     // End the task/session
  | "answer";       // Provide an answer (for Q&A tasks)

export interface Task {
  readonly id: string;
  readonly prompt: string;
  readonly taskType?: string;             // Category/type of task (e.g., "click", "navigate", "wait")
  readonly targetElementId?: string;      // For coordinate-based actions - gets center of element bbox
  readonly action?: TaskAction;           // Override action (e.g., "wait" for loading screens)
  readonly text?: string;                 // For type/answer actions
  readonly keys?: readonly string[];      // For key action: array of key names
  readonly coordinate?: readonly [number, number];  // For mouse actions: [x, y]
  readonly startCoordinate?: readonly [number, number]; // For left_click_drag: start [x, y]
  readonly endCoordinate?: readonly [number, number];   // For left_click_drag: end [x, y]
  readonly pixels?: number;               // For scroll/hscroll: positive=down/right, negative=up/left
  readonly waitTime?: number;             // For wait: seconds
  readonly status?: "success" | "failure"; // For terminate
  readonly priorStates?: readonly ElementPriorState[];
}

export interface AnnotationMetadata {
  readonly sourceApp?: string;
  readonly screenType?: string;
  readonly notes?: string;
}

export interface DataTypeDefinition {
  readonly attributes: readonly string[];
  readonly examples: readonly Record<string, string>[];
}

export interface Annotation {
  readonly screenName: string;
  readonly imageSize: readonly [number, number];
  readonly imagePath: string;
  readonly elements: readonly UIElement[];
  readonly tasks: readonly Task[];
  readonly metadata?: AnnotationMetadata;
  readonly dataTypes?: Record<string, DataTypeDefinition>;
}

export const ELEMENT_TYPES: readonly { readonly value: ElementType; readonly label: string; readonly color: string }[] = [
  { value: "button", label: "Button", color: "#3b82f6" },
  { value: "textinput", label: "Text Input", color: "#22c55e" },
  { value: "label", label: "Label", color: "#eab308" },
  { value: "listbox", label: "List Box", color: "#8b5cf6" },
  { value: "dropdown", label: "Dropdown", color: "#ec4899" },
  { value: "checkbox", label: "Checkbox", color: "#14b8a6" },
  { value: "radio", label: "Radio", color: "#f97316" },
  { value: "grid", label: "Grid", color: "#06b6d4" },
  { value: "icon", label: "Icon", color: "#f59e0b" },
  { value: "dialog", label: "Dialog", color: "#ef4444" },
  { value: "iconlist", label: "Icon List", color: "#a855f7" },
  { value: "menubar", label: "Menu Bar", color: "#64748b" },
  { value: "toolbar", label: "Toolbar", color: "#78716c" },
  { value: "tab", label: "Tab", color: "#0ea5e9" },
  { value: "scrollbar", label: "Scrollbar", color: "#6b7280" },
  { value: "titlebar", label: "Title Bar", color: "#dc2626" },
  { value: "text", label: "Text", color: "#84cc16" },
  { value: "mask", label: "Mask", color: "#71717a" },
  { value: "loading", label: "Loading", color: "#f472b6" },
];

export function getElementColor(type: ElementType): string {
  return ELEMENT_TYPES.find((t) => t.value === type)?.color ?? "#ffffff";
}
