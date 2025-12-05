/**
 * Utility functions for the Annotator application
 */

export {
  getGridPositions,
  getCellBounds,
  getAverageCellSize,
} from "./gridUtils";
export type { GridPositions } from "./gridUtils";

export {
  calculateTolerance,
  addToleranceToElements,
  toleranceToRU,
  DEFAULT_TOLERANCE_SCALE,
} from "./toleranceUtils";

export {
  MASKABLE_TYPES,
  PANEL_TYPES,
  GRID_TYPES,
  COLUMN_ONLY_TYPES,
  EXPORTABLE_ICON_TYPES,
  TEXT_ALIGNABLE_TYPES,
  isMaskable,
  isPanel,
  isGridType,
  isColumnOnly,
  isExportableIcon,
  isTextAlignable,
  getDefaultAction,
} from "./elementTypeUtils";
