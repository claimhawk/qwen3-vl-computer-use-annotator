/**
 * useToolState - Manages tool selection and drawing mode state
 *
 * This hook handles the current drawing tool, draw mode (single/grid),
 * and grid configuration.
 */

import { useState, useCallback, useEffect } from "react";
import { ElementType, UIElement } from "@/types/annotation";

export interface UseToolStateReturn {
  currentType: ElementType;
  setCurrentType: (type: ElementType) => void;
  drawMode: "single" | "grid";
  setDrawMode: (mode: "single" | "grid") => void;
  gridRows: number;
  setGridRows: (rows: number) => void;
  gridCols: number;
  setGridCols: (cols: number) => void;
  isColorSampling: boolean;
  startColorSampling: () => void;
  stopColorSampling: () => void;
  isCropMode: boolean;
  startCropMode: () => void;
  stopCropMode: () => void;
  isIconPlacementMode: boolean;
  startIconPlacementMode: () => void;
  stopIconPlacementMode: () => void;
  syncFromElement: (element: UIElement | undefined) => void;
}

const GRID_ELEMENT_TYPES: ElementType[] = ["grid", "icon", "dropdown", "listbox"];

export function useToolState(): UseToolStateReturn {
  const [currentType, setCurrentType] = useState<ElementType>("button");
  const [drawMode, setDrawMode] = useState<"single" | "grid">("single");
  const [gridRows, setGridRows] = useState(1);
  const [gridCols, setGridCols] = useState(1);
  const [isColorSampling, setIsColorSampling] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  const [isIconPlacementMode, setIsIconPlacementMode] = useState(false);

  const startColorSampling = useCallback(() => {
    setIsColorSampling(true);
    setIsCropMode(false);
    setIsIconPlacementMode(false);
  }, []);

  const stopColorSampling = useCallback(() => {
    setIsColorSampling(false);
  }, []);

  const startCropMode = useCallback(() => {
    setIsCropMode(true);
    setIsColorSampling(false);
    setIsIconPlacementMode(false);
  }, []);

  const stopCropMode = useCallback(() => {
    setIsCropMode(false);
  }, []);

  const startIconPlacementMode = useCallback(() => {
    setIsIconPlacementMode(true);
    setIsColorSampling(false);
    setIsCropMode(false);
  }, []);

  const stopIconPlacementMode = useCallback(() => {
    setIsIconPlacementMode(false);
  }, []);

  const syncFromElement = useCallback((element: UIElement | undefined) => {
    if (element && GRID_ELEMENT_TYPES.includes(element.type)) {
      setGridRows(element.rows ?? 1);
      setGridCols(element.cols ?? 1);
    }
  }, []);

  return {
    currentType,
    setCurrentType,
    drawMode,
    setDrawMode,
    gridRows,
    setGridRows,
    gridCols,
    setGridCols,
    isColorSampling,
    startColorSampling,
    stopColorSampling,
    isCropMode,
    startCropMode,
    stopCropMode,
    isIconPlacementMode,
    startIconPlacementMode,
    stopIconPlacementMode,
    syncFromElement,
  };
}

/**
 * Helper hook to sync grid rows/cols when selected element changes.
 * Use this in the main component to keep tool state in sync with selection.
 */
export function useSyncToolWithSelection(
  toolState: UseToolStateReturn,
  selectedElementId: string | null,
  elements: UIElement[]
) {
  useEffect(() => {
    if (selectedElementId) {
      const element = elements.find((el) => el.id === selectedElementId);
      toolState.syncFromElement(element);
    }
  }, [selectedElementId, elements, toolState]);
}
