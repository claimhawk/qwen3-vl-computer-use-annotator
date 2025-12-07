/**
 * Element type utility functions and constants
 *
 * These utilities help determine element capabilities and behaviors
 * based on element type.
 */

import { ElementType } from "@/types/annotation";

/**
 * Element types that can be masked (filled with background color for templating)
 */
export const MASKABLE_TYPES: readonly ElementType[] = [
  "textinput",
  "dropdown",
  "listbox",
  "grid",
  "icon",
  "iconlist",
  "toolbar",
  "menubar",
  "text",
  "mask",
] as const;

/**
 * Element types that represent panels or containers
 */
export const PANEL_TYPES: readonly ElementType[] = [
  "iconlist",
  "dialog",
  "toolbar",
  "menubar",
] as const;

/**
 * Element types that support grid (rows/cols) configuration
 */
export const GRID_TYPES: readonly ElementType[] = [
  "grid",
  "icon",
  "dropdown",
  "listbox",
] as const;

/**
 * Element types that support column configuration only (not rows)
 */
export const COLUMN_ONLY_TYPES: readonly ElementType[] = [
  "dropdown",
  "listbox",
] as const;

/**
 * Element types that can be exported as icon images
 */
export const EXPORTABLE_ICON_TYPES: readonly ElementType[] = [
  "icon",
  "iconlist",
  "toolbar",
  "menubar",
] as const;

/**
 * Element types that can have text alignment
 */
export const TEXT_ALIGNABLE_TYPES: readonly ElementType[] = [
  "text",
  "button",
  "textinput",
] as const;

/**
 * Check if an element type is maskable
 */
export function isMaskable(type: ElementType): boolean {
  return (MASKABLE_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an element type is a panel/container
 */
export function isPanel(type: ElementType): boolean {
  return (PANEL_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an element type supports grid configuration
 */
export function isGridType(type: ElementType): boolean {
  return (GRID_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an element type supports only column (not row) configuration
 */
export function isColumnOnly(type: ElementType): boolean {
  return (COLUMN_ONLY_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an element type can be exported as an icon
 */
export function isExportableIcon(type: ElementType): boolean {
  return (EXPORTABLE_ICON_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an element type can have text alignment
 */
export function isTextAlignable(type: ElementType): boolean {
  return (TEXT_ALIGNABLE_TYPES as readonly string[]).includes(type);
}

/**
 * Get the default task action for an element type
 */
export function getDefaultAction(type: ElementType): string {
  switch (type) {
    case "textinput":
      return "type";
    case "dropdown":
    case "listbox":
    case "button":
    case "tab":
    case "checkbox":
    case "radio":
    case "icon":
    case "menubar":
    case "toolbar":
      return "left_click";
    case "scrollbar":
      return "scroll";
    case "loading":
      return "wait";
    default:
      return "left_click";
  }
}
