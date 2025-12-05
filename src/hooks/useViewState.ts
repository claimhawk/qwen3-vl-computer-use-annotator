/**
 * useViewState - Manages view/zoom/UI state
 *
 * This hook handles zoom level and panel collapse states.
 */

import { useState, useCallback } from "react";

export interface UseViewStateReturn {
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  elementsCollapsed: boolean;
  toggleElementsCollapsed: () => void;
  setElementsCollapsed: (collapsed: boolean) => void;
  tasksCollapsed: boolean;
  toggleTasksCollapsed: () => void;
  setTasksCollapsed: (collapsed: boolean) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function useViewState(): UseViewStateReturn {
  const [zoomLevel, setZoomLevelInternal] = useState(1);
  const [elementsCollapsed, setElementsCollapsed] = useState(false);
  const [tasksCollapsed, setTasksCollapsed] = useState(false);

  const setZoomLevel = useCallback((level: number) => {
    setZoomLevelInternal(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)));
  }, []);

  const zoomIn = useCallback(() => {
    setZoomLevelInternal((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevelInternal((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevelInternal(1);
  }, []);

  const toggleElementsCollapsed = useCallback(() => {
    setElementsCollapsed((c) => !c);
  }, []);

  const toggleTasksCollapsed = useCallback(() => {
    setTasksCollapsed((c) => !c);
  }, []);

  return {
    zoomLevel,
    setZoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    elementsCollapsed,
    toggleElementsCollapsed,
    setElementsCollapsed,
    tasksCollapsed,
    toggleTasksCollapsed,
    setTasksCollapsed,
  };
}
