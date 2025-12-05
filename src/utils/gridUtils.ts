/**
 * Grid utility functions
 *
 * These functions are used for calculating grid cell positions
 * in both the main page and AnnotationCanvas components.
 */

import { UIElement } from "@/types/annotation";

export interface GridPositions {
  /** X coordinates of vertical divider lines */
  colPositions: number[];
  /** Y coordinates of horizontal divider lines */
  rowPositions: number[];
  /** X boundaries including start and end (length = cols + 1) */
  colBounds: number[];
  /** Y boundaries including start and end (length = rows + 1) */
  rowBounds: number[];
}

/**
 * Calculate grid cell positions based on custom or uniform sizes.
 *
 * @param el - The UI element with grid configuration
 * @returns Grid positions including divider lines and cell bounds
 */
export function getGridPositions(el: UIElement): GridPositions {
  const rows = el.rows || 1;
  const cols = el.cols || 1;
  const { x, y, width, height } = el.bbox;

  // Column positions (x coordinates of vertical dividers)
  const colPositions: number[] = [];
  if (el.colWidths && el.colWidths.length === cols) {
    let cumX = x;
    for (let c = 0; c < cols - 1; c++) {
      cumX += el.colWidths[c] * width;
      colPositions.push(cumX);
    }
  } else {
    const cellWidth = width / cols;
    for (let c = 1; c < cols; c++) {
      colPositions.push(x + c * cellWidth);
    }
  }

  // Row positions (y coordinates of horizontal dividers)
  const rowPositions: number[] = [];
  if (el.rowHeights && el.rowHeights.length === rows) {
    let cumY = y;
    for (let r = 0; r < rows - 1; r++) {
      cumY += el.rowHeights[r] * height;
      rowPositions.push(cumY);
    }
  } else {
    const cellHeight = height / rows;
    for (let r = 1; r < rows; r++) {
      rowPositions.push(y + r * cellHeight);
    }
  }

  // Build complete bounds arrays
  const colBounds = [x, ...colPositions, x + width];
  const rowBounds = [y, ...rowPositions, y + height];

  return { colPositions, rowPositions, colBounds, rowBounds };
}

/**
 * Get the bounds of a specific grid cell.
 *
 * @param el - The UI element with grid configuration
 * @param row - Row index (0-based)
 * @param col - Column index (0-based)
 * @returns Bounding box of the cell
 */
export function getCellBounds(
  el: UIElement,
  row: number,
  col: number
): { x: number; y: number; width: number; height: number } {
  const { colBounds, rowBounds } = getGridPositions(el);

  const cellX = colBounds[col];
  const cellY = rowBounds[row];
  const cellWidth = colBounds[col + 1] - colBounds[col];
  const cellHeight = rowBounds[row + 1] - rowBounds[row];

  return { x: cellX, y: cellY, width: cellWidth, height: cellHeight };
}

/**
 * Calculate the average cell size for a grid element.
 * Used for computing tolerance values.
 *
 * @param el - The UI element with grid configuration
 * @returns Average cell width and height
 */
export function getAverageCellSize(el: UIElement): { width: number; height: number } {
  const rows = el.rows || 1;
  const cols = el.cols || 1;

  let cellWidth: number;
  let cellHeight: number;

  if (rows > 1 || cols > 1) {
    // Grid element - compute average cell size based on custom or uniform divisions
    if (el.colWidths && el.colWidths.length === cols) {
      const avgColFraction = el.colWidths.reduce((a, b) => a + b, 0) / cols;
      cellWidth = avgColFraction * el.bbox.width;
    } else {
      cellWidth = el.bbox.width / cols;
    }

    if (el.rowHeights && el.rowHeights.length === rows) {
      const avgRowFraction = el.rowHeights.reduce((a, b) => a + b, 0) / rows;
      cellHeight = avgRowFraction * el.bbox.height;
    } else {
      cellHeight = el.bbox.height / rows;
    }
  } else {
    // Single element - use full dimensions
    cellWidth = el.bbox.width;
    cellHeight = el.bbox.height;
  }

  return { width: cellWidth, height: cellHeight };
}
