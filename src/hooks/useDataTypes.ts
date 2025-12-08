/**
 * useDataTypes Hook
 *
 * State management for the Data Type Extractor feature.
 * Handles structured data types with attributes and example instances.
 */

import { useState, useCallback } from "react";
import type {
  DataType,
  DataTypesState,
  Extraction,
  CropRect,
  DataTypesExport,
  UploadedImage,
  PendingExtraction,
} from "@/types/dataTypes";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const initialState: DataTypesState = {
  types: [],
  selectedTypeId: null,
  images: [],
  currentImageIndex: 0,
  isExtracting: false,
  lastOcrText: null,
  pendingExtraction: null,
};

export function useDataTypes() {
  const [state, setState] = useState<DataTypesState>(initialState);

  // Get the currently selected type
  const selectedType = state.types.find((t) => t.id === state.selectedTypeId) ?? null;

  // Add a new data type
  const addType = useCallback((name: string) => {
    const newType: DataType = {
      id: generateId(),
      name: name.trim(),
      attributes: [],
      examples: [],
      extractions: [],
    };
    setState((prev) => ({
      ...prev,
      types: [...prev.types, newType],
      selectedTypeId: newType.id,
    }));
    return newType.id;
  }, []);

  // Delete a data type
  const deleteType = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      types: prev.types.filter((t) => t.id !== id),
      selectedTypeId: prev.selectedTypeId === id ? null : prev.selectedTypeId,
    }));
  }, []);

  // Select a data type (keep images for reuse across types)
  const selectType = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedTypeId: id,
      lastOcrText: null,
      pendingExtraction: null,
    }));
  }, []);

  // Rename a data type
  const renameType = useCallback((id: string, newName: string) => {
    setState((prev) => ({
      ...prev,
      types: prev.types.map((t) =>
        t.id === id ? { ...t, name: newName.trim() } : t
      ),
    }));
  }, []);

  // Add images (supports multiple)
  const addImages = useCallback((dataUrls: string[]) => {
    const newImages: UploadedImage[] = dataUrls.map((dataUrl) => ({
      id: generateId(),
      dataUrl,
      cropRect: null,
    }));
    setState((prev) => ({
      ...prev,
      images: [...prev.images, ...newImages],
      currentImageIndex: prev.images.length === 0 ? 0 : prev.currentImageIndex,
    }));
  }, []);

  // Remove an image by index
  const removeImage = useCallback((index: number) => {
    setState((prev) => {
      const newImages = prev.images.filter((_, i) => i !== index);
      let newIndex = prev.currentImageIndex;
      if (newIndex >= newImages.length) {
        newIndex = Math.max(0, newImages.length - 1);
      }
      return {
        ...prev,
        images: newImages,
        currentImageIndex: newIndex,
      };
    });
  }, []);

  // Set current image index
  const setCurrentImageIndex = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      currentImageIndex: Math.max(0, Math.min(index, prev.images.length - 1)),
    }));
  }, []);

  // Set the crop rectangle for current image
  const setCropRect = useCallback((rect: CropRect | null) => {
    setState((prev) => {
      if (prev.images.length === 0) return prev;
      const newImages = prev.images.map((img, i) =>
        i === prev.currentImageIndex ? { ...img, cropRect: rect } : img
      );
      return {
        ...prev,
        images: newImages,
      };
    });
  }, []);

  // Get current image
  const currentImage = state.images[state.currentImageIndex] ?? null;

  // Set extracting state
  const setIsExtracting = useCallback((isExtracting: boolean) => {
    setState((prev) => ({
      ...prev,
      isExtracting,
    }));
  }, []);

  // Set last OCR text
  const setLastOcrText = useCallback((text: string | null) => {
    setState((prev) => ({
      ...prev,
      lastOcrText: text,
    }));
  }, []);

  // Set pending extraction (parsed table awaiting confirmation)
  const setPendingExtraction = useCallback((pending: PendingExtraction | null) => {
    setState((prev) => ({
      ...prev,
      pendingExtraction: pending,
    }));
  }, []);

  // Confirm pending extraction - add to selected type
  const confirmExtraction = useCallback(() => {
    if (!state.selectedTypeId || !state.pendingExtraction) return;

    const { headers, rows, imageDataUrl, rawOcrText } = state.pendingExtraction;

    const extraction: Extraction = {
      id: generateId(),
      timestamp: Date.now(),
      imageDataUrl,
      rawOcrText,
      rows: [...rows],
    };

    setState((prev) => ({
      ...prev,
      pendingExtraction: null,
      types: prev.types.map((t) => {
        if (t.id !== prev.selectedTypeId) return t;

        // Merge attributes (add new ones)
        const existingAttrs = new Set(t.attributes);
        const newAttrs = headers.filter((h) => !existingAttrs.has(h));
        const mergedAttrs = [...t.attributes, ...newAttrs];

        // Add new examples
        const mergedExamples = [...t.examples, ...rows];

        return {
          ...t,
          attributes: mergedAttrs,
          examples: mergedExamples,
          extractions: [...t.extractions, extraction],
        };
      }),
    }));
  }, [state.selectedTypeId, state.pendingExtraction]);

  // Cancel pending extraction
  const cancelExtraction = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pendingExtraction: null,
    }));
  }, []);

  // Remove an example from the selected type
  const removeExample = useCallback(
    (index: number) => {
      if (!state.selectedTypeId) return;

      setState((prev) => ({
        ...prev,
        types: prev.types.map((t) => {
          if (t.id !== prev.selectedTypeId) return t;
          return {
            ...t,
            examples: t.examples.filter((_, i) => i !== index),
          };
        }),
      }));
    },
    [state.selectedTypeId]
  );

  // Clear all examples from the selected type
  const clearExamples = useCallback(() => {
    if (!state.selectedTypeId) return;

    setState((prev) => ({
      ...prev,
      types: prev.types.map((t) => {
        if (t.id !== prev.selectedTypeId) return t;
        return {
          ...t,
          examples: [],
          extractions: [],
        };
      }),
    }));
  }, [state.selectedTypeId]);

  // Clear all images
  const clearImages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      images: [],
      currentImageIndex: 0,
      lastOcrText: null,
      pendingExtraction: null,
    }));
  }, []);

  // Export all types as JSON
  const exportJson = useCallback((): DataTypesExport => {
    const result: DataTypesExport = {};
    for (const t of state.types) {
      result[t.name] = {
        attributes: [...t.attributes],
        examples: t.examples.map((e) => ({ ...e })),
      };
    }
    return result;
  }, [state.types]);

  // Clear all state
  const clearAll = useCallback(() => {
    setState(initialState);
  }, []);

  // Load data types from saved annotation
  const loadDataTypes = useCallback((savedDataTypes: Record<string, { attributes: string[]; examples: Record<string, string>[] }>) => {
    const types: DataType[] = Object.entries(savedDataTypes).map(([name, data]) => ({
      id: generateId(),
      name,
      attributes: data.attributes || [],
      examples: data.examples || [],
      extractions: [],
    }));
    setState((prev) => ({
      ...prev,
      types,
      selectedTypeId: types.length > 0 ? types[0].id : null,
    }));
  }, []);

  return {
    // State
    types: state.types,
    selectedTypeId: state.selectedTypeId,
    selectedType,
    images: state.images,
    currentImageIndex: state.currentImageIndex,
    currentImage,
    isExtracting: state.isExtracting,
    lastOcrText: state.lastOcrText,
    pendingExtraction: state.pendingExtraction,

    // Actions
    addType,
    deleteType,
    selectType,
    renameType,
    addImages,
    removeImage,
    setCurrentImageIndex,
    setCropRect,
    setIsExtracting,
    setLastOcrText,
    setPendingExtraction,
    confirmExtraction,
    cancelExtraction,
    removeExample,
    clearExamples,
    clearImages,
    exportJson,
    clearAll,
    loadDataTypes,
  };
}
