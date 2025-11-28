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
  | "panel"
  | "text";

export interface BBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type PanelLayout = "sparse" | "stacked" | "random";
export type HAlign = "left" | "center" | "right";
export type VAlign = "top" | "center" | "bottom";

export interface UIElement {
  readonly id: string;
  readonly type: ElementType;
  readonly bbox: BBox;
  readonly text?: string;
  readonly parentId?: string;
  readonly rows?: number;
  readonly cols?: number;
  readonly mask?: boolean;
  readonly maskColor?: string;
  readonly layout?: PanelLayout;  // For panels: how child icons are arranged
  readonly randomOrder?: boolean; // For panels: randomize icon order
  readonly exportIcon?: boolean;  // For icons: include cropped image in export
  readonly hAlign?: HAlign;       // For text: horizontal alignment
  readonly vAlign?: VAlign;       // For text: vertical alignment
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
  readonly targetElementId?: string;      // For click/type - action inferred from element type
  readonly action?: TaskAction;           // Override action (e.g., "wait" for loading screens)
  readonly text?: string;                 // For textinput: text to type (generates click + type)
  readonly priorStates?: readonly ElementPriorState[];
}

export interface AnnotationMetadata {
  readonly sourceApp?: string;
  readonly screenType?: string;
  readonly notes?: string;
}

export interface Annotation {
  readonly screenName: string;
  readonly imageSize: readonly [number, number];
  readonly imagePath: string;
  readonly elements: readonly UIElement[];
  readonly tasks: readonly Task[];
  readonly metadata?: AnnotationMetadata;
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
  { value: "panel", label: "Panel", color: "#a855f7" },
  { value: "menubar", label: "Menu Bar", color: "#64748b" },
  { value: "toolbar", label: "Toolbar", color: "#78716c" },
  { value: "tab", label: "Tab", color: "#0ea5e9" },
  { value: "scrollbar", label: "Scrollbar", color: "#6b7280" },
  { value: "titlebar", label: "Title Bar", color: "#dc2626" },
  { value: "text", label: "Text", color: "#84cc16" },
];

export function getElementColor(type: ElementType): string {
  return ELEMENT_TYPES.find((t) => t.value === type)?.color ?? "#ffffff";
}
