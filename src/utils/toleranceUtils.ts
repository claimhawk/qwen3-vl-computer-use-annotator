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
 * Add tolerance values to all elements in an array.
 * This is used when exporting annotations.
 *
 * @param elements - Array of UI elements
 * @param scale - Fraction of size to use as tolerance (default 0.7)
 * @returns Elements with toleranceX and toleranceY added
 */
export function addToleranceToElements(
  elements: UIElement[],
  scale: number = DEFAULT_TOLERANCE_SCALE
): (UIElement & { toleranceX: number; toleranceY: number })[] {
  return elements.map((el) => {
    const tolerance = calculateTolerance(el, scale);
    return {
      ...el,
      toleranceX: tolerance.x,
      toleranceY: tolerance.y,
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
