/**
 * Tolerance utility functions
 *
 * Functions for calculating click tolerance values for elements.
 * Tolerance determines how close a click needs to be to the target
 * coordinate to be considered correct.
 */

import { UIElement } from "@/types/annotation";
import { getAverageCellSize } from "./gridUtils";

/**
 * Default tolerance scale (70% of element/cell size)
 */
export const DEFAULT_TOLERANCE_SCALE = 0.7;

/**
 * Calculate tolerance values for an element.
 * For grid elements, uses average cell size instead of full element size.
 *
 * @param el - The UI element
 * @param scale - Fraction of size to use as tolerance (default 0.7)
 * @returns Tolerance in pixels { x, y }
 */
export function calculateTolerance(
  el: UIElement,
  scale: number = DEFAULT_TOLERANCE_SCALE
): { x: number; y: number } {
  const { width, height } = getAverageCellSize(el);
  return {
    x: Math.round(width * scale),
    y: Math.round(height * scale),
  };
}

/**
 * Add tolerance values and default grid dimensions to all elements in an array.
 * This is used when exporting annotations.
 *
 * For grid elements with rows/cols > 1:
 * - Adds colWidths if not set (uniform: 1/cols for each)
 * - Adds rowHeights if not set (uniform: 1/rows for each)
 *
 * @param elements - Array of UI elements
 * @param scale - Fraction of size to use as tolerance (default 0.7)
 * @returns Elements with toleranceX, toleranceY, and grid dimensions added
 */
export function addToleranceToElements(
  elements: UIElement[],
  scale: number = DEFAULT_TOLERANCE_SCALE
): UIElement[] {
  return elements.map((el) => {
    const tolerance = calculateTolerance(el, scale);
    const rows = el.rows || 1;
    const cols = el.cols || 1;

    // Compute default colWidths/rowHeights if grid has divisions but no custom sizes
    let colWidths = el.colWidths;
    let rowHeights = el.rowHeights;

    if (cols > 1 && !colWidths) {
      const uniformWidth = 1 / cols;
      colWidths = Array(cols).fill(uniformWidth);
    }

    if (rows > 1 && !rowHeights) {
      const uniformHeight = 1 / rows;
      rowHeights = Array(rows).fill(uniformHeight);
    }

    return {
      ...el,
      toleranceX: tolerance.x,
      toleranceY: tolerance.y,
      ...(colWidths && { colWidths }),
      ...(rowHeights && { rowHeights }),
    };
  });
}

/**
 * Convert pixel tolerance to RU (Resolution Units) normalized to [0, 1000].
 *
 * @param tolerancePixels - Tolerance in pixels { x, y }
 * @param imageSize - Image size [width, height]
 * @returns Tolerance in RU units
 */
export function toleranceToRU(
  tolerancePixels: { x: number; y: number },
  imageSize: [number, number]
): { x: number; y: number } {
  const scale = 1000 / Math.max(imageSize[0], imageSize[1]);
  return {
    x: Math.round(tolerancePixels.x * scale),
    y: Math.round(tolerancePixels.y * scale),
  };
}
