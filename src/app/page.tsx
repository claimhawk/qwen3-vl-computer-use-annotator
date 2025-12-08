"use client";

import { useState, useCallback, useEffect, DragEvent } from "react";
import AnnotationCanvas from "@/components/AnnotationCanvas";
import ElementList from "@/components/ElementList";
import TaskList from "@/components/TaskList";
import DataTypesModal from "@/components/DataTypesModal";
import {
  ElementType,
  ELEMENT_TYPES,
  BBox,
  IconDefinition,
} from "@/types/annotation";

// Custom hooks
import {
  useAnnotationState,
  useImageState,
  useToolState,
  useViewState,
  useDataTypes,
} from "@/hooks";

// Services
import {
  createExportZip,
  loadExportZip,
  loadAnnotationJson,
  clipMaskedRegions,
} from "@/services";
import { transcribeRegions } from "@/services/chandraService";

// Utilities
import { isGridType } from "@/utils";

export default function Home() {
  // Use custom hooks for state management
  const annotation = useAnnotationState();
  const image = useImageState();
  const tools = useToolState();
  const view = useViewState();
  const dataTypes = useDataTypes();

  // Drag-drop state (kept local as it's UI-only)
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isRunningOcr, setIsRunningOcr] = useState(false);
  const [cropRect, setCropRect] = useState<BBox | null>(null);
  const [showDataTypesModal, setShowDataTypesModal] = useState(false);

  // Generator state
  const [generators, setGenerators] = useState<{ name: string; path: string; hasAnnotations: boolean }[]>([]);
  const [selectedGenerator, setSelectedGenerator] = useState<string>("");
  const [loadingGenerators, setLoadingGenerators] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedState, setLastSavedState] = useState<string>("");

  // Track unsaved changes by comparing current state to last saved state
  useEffect(() => {
    const currentState = JSON.stringify({
      elements: annotation.elements,
      tasks: annotation.tasks,
      screenName: image.screenName,
    });
    if (lastSavedState && currentState !== lastSavedState) {
      setHasUnsavedChanges(true);
    }
  }, [annotation.elements, annotation.tasks, image.screenName, lastSavedState]);

  // Fetch generators on mount
  useEffect(() => {
    async function fetchGenerators() {
      try {
        const res = await fetch("/api/generators");
        if (res.ok) {
          const data = await res.json();
          setGenerators(data.generators || []);
        }
      } catch (err) {
        console.error("Failed to fetch generators:", err);
      } finally {
        setLoadingGenerators(false);
      }
    }
    fetchGenerators();
  }, []);

  // Check if there are any elements with OCR checked
  const hasOcrElements = annotation.elements.some((el) => el.ocr === true);

  // Check if there are elements needing OCR (ocr=true but no transcription yet)
  const ocrPending = annotation.elements.some(
    (el) => el.ocr === true && el.transcription === undefined
  );

  // Run OCR on ALL elements with ocr=true (allows re-running)
  const runOcr = useCallback(async () => {
    if (!image.imageUrl) return;

    const elementsNeedingOcr = annotation.elements.filter(
      (el) => el.ocr === true
    );

    if (elementsNeedingOcr.length === 0) return;

    setIsRunningOcr(true);

    try {
      console.log("[OCR] Running OCR on", elementsNeedingOcr.length, "elements");

      // Clip regions for OCR
      const regions = await clipMaskedRegions(image.imageUrl, elementsNeedingOcr);
      console.log("[OCR] Clipped", regions.length, "regions");

      // Run transcription
      const transcriptions = await transcribeRegions(regions);
      console.log("[OCR] Got transcriptions:", transcriptions);

      // Update elements with transcriptions
      const transcriptionMap = new Map<string, string>();
      for (const t of transcriptions) {
        transcriptionMap.set(t.elementId, t.text || "(no text detected)");
      }

      annotation.setElements((prev) =>
        prev.map((el) => {
          const text = transcriptionMap.get(el.id);
          if (text !== undefined) {
            return { ...el, transcription: text };
          }
          return el;
        })
      );
    } catch (err) {
      console.error("[OCR] Failed:", err);
      alert("OCR failed - check console for details");
    } finally {
      setIsRunningOcr(false);
    }
  }, [image.imageUrl, annotation]);

  // Sync grid rows/cols when selected element changes
  useEffect(() => {
    if (annotation.selectedElementId) {
      const el = annotation.elements.find((el) => el.id === annotation.selectedElementId);
      if (el && isGridType(el.type)) {
        tools.setGridRows(el.rows ?? 1);
        tools.setGridCols(el.cols ?? 1);
      }
    }
  }, [annotation.selectedElementId, annotation.elements]);

  // Handle file drop
  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".zip")) {
      try {
        const { annotation: loadedAnnotation, imageUrl } = await loadExportZip(file);
        image.setScreenName(loadedAnnotation.screenName);
        image.setImageData(imageUrl, [...loadedAnnotation.imageSize] as [number, number], loadedAnnotation.imagePath || "");
        annotation.loadAnnotation(loadedAnnotation.elements, loadedAnnotation.tasks || []);
      } catch (err) {
        alert("Failed to load ZIP file");
        console.error(err);
      }
    } else if (file.type.startsWith("image/")) {
      try {
        await image.loadImageFile(file);
        annotation.clearAll();
      } catch (err) {
        alert("Failed to load image");
        console.error(err);
      }
    }
  }, [image, annotation]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  // Handle applying the crop
  const handleApplyCrop = useCallback(async () => {
    if (!cropRect || !image.imageUrl || !image.imageSize) return;
    if (cropRect.width < 10 || cropRect.height < 10) return;

    const cropBbox = cropRect;

    // Crop the image
    await image.cropToRegion(cropBbox);

    // Adjust elements inside the crop region
    annotation.setElements((prev) => {
      const adjusted = [];
      for (const el of prev) {
        const elRight = el.bbox.x + el.bbox.width;
        const elBottom = el.bbox.y + el.bbox.height;
        const cropRight = cropBbox.x + cropBbox.width;
        const cropBottom = cropBbox.y + cropBbox.height;

        if (
          el.bbox.x >= cropBbox.x &&
          el.bbox.y >= cropBbox.y &&
          elRight <= cropRight &&
          elBottom <= cropBottom
        ) {
          adjusted.push({
            ...el,
            bbox: {
              x: el.bbox.x - cropBbox.x,
              y: el.bbox.y - cropBbox.y,
              width: el.bbox.width,
              height: el.bbox.height,
            },
          });
        }
      }
      return adjusted;
    });

    annotation.selectElement(null);
    setCropRect(null);
    tools.stopCropMode();
  }, [cropRect, annotation, image, tools]);

  // Handle color sampling
  const handleColorSampled = useCallback((color: string) => {
    if (annotation.selectedElementId) {
      annotation.updateElement(annotation.selectedElementId, { maskColor: color });
    }
    tools.stopColorSampling();
  }, [annotation, tools]);

  // Handle icon placement on iconlist
  const handleIconPlaced = useCallback((elementId: string, icon: IconDefinition) => {
    const el = annotation.elements.find((e) => e.id === elementId);
    if (!el) return;

    const existingIcons = el.icons ?? [];

    annotation.updateElement(elementId, {
      icons: [...existingIcons, icon],
    });

    // Ensure iconlist has its task template
    annotation.ensureIconListTask(elementId);
  }, [annotation]);


  // Handle download ZIP (and optionally save to generator)
  const downloadZip = useCallback(async () => {
    if (!image.imageSize || !image.imageUrl) return;

    setIsExporting(true);
    setExportStatus("Preparing...");

    try {
      const exportedDataTypes = dataTypes.exportJson();
      const zipBlob = await createExportZip(
        image.imageUrl,
        {
          screenName: image.screenName,
          imageSize: image.imageSize,
          imagePath: image.imagePath,
          elements: annotation.elements,
          tasks: annotation.tasks,
          dataTypes: Object.keys(exportedDataTypes).length > 0 ? exportedDataTypes : undefined,
        },
        (status) => setExportStatus(status)
      );

      // If a generator is selected, save to it via API
      if (selectedGenerator) {
        setExportStatus("Saving to generator...");
        const formData = new FormData();
        formData.append("generator", selectedGenerator);
        formData.append("zip", zipBlob, `${image.screenName}.zip`);

        const res = await fetch("/api/generators/save", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to save to generator");
        }

        const result = await res.json();
        console.log("Saved to generator:", result);
        setExportStatus("Saved!");

        // Brief delay to show success message
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        // No generator selected, just download
        setExportStatus("Downloading...");
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${image.screenName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create ZIP");
      console.error(err);
    } finally {
      setIsExporting(false);
      setExportStatus(null);
    }
  }, [image, annotation, selectedGenerator, dataTypes]);

  // Handle import from file
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".zip")) {
      try {
        const { annotation: loadedAnnotation, imageUrl } = await loadExportZip(file);
        image.setScreenName(loadedAnnotation.screenName);
        image.setImageData(imageUrl, [...loadedAnnotation.imageSize] as [number, number], loadedAnnotation.imagePath || "");
        annotation.loadAnnotation(loadedAnnotation.elements, loadedAnnotation.tasks || []);
      } catch (err) {
        alert("Failed to load ZIP file");
        console.error(err);
      }
    } else {
      try {
        const loadedAnnotation = await loadAnnotationJson(file);
        image.setScreenName(loadedAnnotation.screenName);
        annotation.loadAnnotation(loadedAnnotation.elements, loadedAnnotation.tasks || []);
        if (loadedAnnotation.imagePath) {
          // Note: JSON-only import doesn't include the image
        }
      } catch (err) {
        alert("Failed to parse annotation file");
        console.error(err);
      }
    }
  }, [image, annotation]);

  // Handle generator change with unsaved changes warning and auto-load
  const handleGeneratorChange = useCallback(async (newGenerator: string) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Discard changes and switch generator?"
      );
      if (!confirmed) return;
    }
    setSelectedGenerator(newGenerator);
    setHasUnsavedChanges(false);
    setLastSavedState("");

    // Auto-load if generator has annotations
    if (newGenerator) {
      const gen = generators.find(g => g.name === newGenerator);
      if (gen?.hasAnnotations) {
        try {
          const res = await fetch(`/api/generators/load?generator=${encodeURIComponent(newGenerator)}`);
          if (res.ok) {
            const data = await res.json();
            const loadedAnnotation = data.annotation;
            console.log("[LOAD] loadedAnnotation:", loadedAnnotation);
            console.log("[LOAD] loadedAnnotation.dataTypes:", loadedAnnotation.dataTypes);

            image.setScreenName(loadedAnnotation.screenName);

            if (data.imageDataUrl) {
              image.setImageData(
                data.imageDataUrl,
                [...loadedAnnotation.imageSize] as [number, number],
                loadedAnnotation.imagePath || ""
              );
            }

            annotation.loadAnnotation(loadedAnnotation.elements, loadedAnnotation.tasks || []);

            // Load data types if present
            if (loadedAnnotation.dataTypes) {
              dataTypes.loadDataTypes(loadedAnnotation.dataTypes);
            } else {
              dataTypes.clearAll();
            }

            // Mark as saved state
            const savedState = JSON.stringify({
              elements: loadedAnnotation.elements,
              tasks: loadedAnnotation.tasks || [],
              screenName: loadedAnnotation.screenName,
            });
            setLastSavedState(savedState);
          }
        } catch (err) {
          console.error("Failed to auto-load generator:", err);
        }
      }
    }
  }, [hasUnsavedChanges, generators, image, annotation, dataTypes]);

  // Save to generator config folder (annotated.zip + annotation.json)
  const saveToConfig = useCallback(async () => {
    if (!selectedGenerator || !image.imageSize || !image.imageUrl) return;

    setIsExporting(true);
    setExportStatus("Preparing...");

    try {
      // Create the ZIP
      const zipBlob = await createExportZip(
        image.imageUrl,
        {
          screenName: image.screenName,
          imageSize: image.imageSize,
          imagePath: image.imagePath,
          elements: annotation.elements,
          tasks: annotation.tasks,
        },
        (status) => setExportStatus(status)
      );

      // Create annotation JSON (include data types if any)
      const exportedDataTypes = dataTypes.exportJson();
      console.log("[SAVE] dataTypes.types:", dataTypes.types);
      console.log("[SAVE] exportedDataTypes:", exportedDataTypes);
      const annotationData = JSON.stringify({
        screenName: image.screenName,
        imageSize: image.imageSize,
        imagePath: image.imagePath,
        elements: annotation.elements,
        tasks: annotation.tasks,
        ...(Object.keys(exportedDataTypes).length > 0 && { dataTypes: exportedDataTypes }),
      }, null, 2);

      setExportStatus("Saving to config...");

      const formData = new FormData();
      formData.append("generator", selectedGenerator);
      formData.append("zip", zipBlob, "annotated.zip");
      formData.append("annotation", annotationData);

      const res = await fetch("/api/generators/save-config", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save to config");
      }

      // Update generators list to reflect new annotation
      setGenerators((prev) =>
        prev.map((g) =>
          g.name === selectedGenerator ? { ...g, hasAnnotations: true } : g
        )
      );

      // Mark as saved
      const savedState = JSON.stringify({
        elements: annotation.elements,
        tasks: annotation.tasks,
        screenName: image.screenName,
      });
      setLastSavedState(savedState);
      setHasUnsavedChanges(false);

      setExportStatus("Saved!");
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save to config");
      console.error(err);
    } finally {
      setIsExporting(false);
      setExportStatus(null);
    }
  }, [selectedGenerator, image, annotation, dataTypes]);

  // Handle grid row/col changes that also update selected element
  // Preserves existing row/col positions when adding/removing
  const handleGridRowsChange = useCallback((val: number) => {
    tools.setGridRows(val);
    if (annotation.selectedElementId) {
      const el = annotation.elements.find((e) => e.id === annotation.selectedElementId);
      if (el && isGridType(el.type)) {
        const oldRows = el.rows || 1;
        const oldHeights = el.rowHeights && el.rowHeights.length === oldRows
          ? [...el.rowHeights]
          : Array(oldRows).fill(1 / oldRows);

        let newHeights: number[];
        if (val > oldRows) {
          // Adding rows: split last row
          const addCount = val - oldRows;
          const lastHeight = oldHeights[oldRows - 1];
          const splitHeight = lastHeight / (addCount + 1);
          newHeights = [...oldHeights.slice(0, -1), ...Array(addCount + 1).fill(splitHeight)];
        } else if (val < oldRows) {
          // Removing rows: merge into last remaining
          const removed = oldHeights.slice(val - 1);
          const removedSum = removed.reduce((a, b) => a + b, 0);
          newHeights = [...oldHeights.slice(0, val - 1), removedSum];
        } else {
          newHeights = oldHeights;
        }

        annotation.updateElement(annotation.selectedElementId, { rows: val, rowHeights: newHeights });
      }
    }
  }, [tools, annotation]);

  const handleGridColsChange = useCallback((val: number) => {
    tools.setGridCols(val);
    if (annotation.selectedElementId) {
      const el = annotation.elements.find((e) => e.id === annotation.selectedElementId);
      if (el && ["grid", "icon"].includes(el.type)) {
        const oldCols = el.cols || 1;
        const oldWidths = el.colWidths && el.colWidths.length === oldCols
          ? [...el.colWidths]
          : Array(oldCols).fill(1 / oldCols);

        let newWidths: number[];
        if (val > oldCols) {
          // Adding cols: split last col
          const addCount = val - oldCols;
          const lastWidth = oldWidths[oldCols - 1];
          const splitWidth = lastWidth / (addCount + 1);
          newWidths = [...oldWidths.slice(0, -1), ...Array(addCount + 1).fill(splitWidth)];
        } else if (val < oldCols) {
          // Removing cols: merge into last remaining
          const removed = oldWidths.slice(val - 1);
          const removedSum = removed.reduce((a, b) => a + b, 0);
          newWidths = [...oldWidths.slice(0, val - 1), removedSum];
        } else {
          newWidths = oldWidths;
        }

        annotation.updateElement(annotation.selectedElementId, { cols: val, colWidths: newWidths });
      }
    }
  }, [tools, annotation]);

  return (
    <div
      className="h-screen flex flex-col"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-600/20 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
          <div className="bg-zinc-900/90 px-8 py-6 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-400">Drop here</p>
            <p className="text-zinc-400 mt-2">Image or exported .zip</p>
          </div>
        </div>
      )}

      {/* Top toolbar */}
      <header className="flex items-center gap-4 px-4 py-2 bg-zinc-800 border-b border-zinc-700">
        <h1 className="text-lg font-bold">UI Grounding Annotator</h1>

        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Screen Name:</label>
          <input
            type="text"
            value={image.screenName}
            onChange={(e) => image.setScreenName(e.target.value)}
            className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm w-48"
          />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {/* Generator selector */}
          <div className="flex items-center gap-1">
            {hasUnsavedChanges && (
              <span className="text-yellow-400 text-xs" title="Unsaved changes">●</span>
            )}
            <select
              value={selectedGenerator}
              onChange={(e) => handleGeneratorChange(e.target.value)}
              disabled={loadingGenerators}
              className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-sm min-w-[200px]"
            >
              <option value="">No generator (file only)</option>
              {generators.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name} {g.hasAnnotations ? "●" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Import from file */}
          <label className="relative cursor-pointer bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded text-sm">
            Import
            <input
              type="file"
              accept=".json,.zip"
              onChange={handleImportFile}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>

          {/* Save to config button (disk icon) */}
          {selectedGenerator && (
            <button
              onClick={saveToConfig}
              disabled={annotation.elements.length === 0 || isExporting || ocrPending || isRunningOcr}
              className={`p-1.5 rounded ${
                hasUnsavedChanges
                  ? "bg-yellow-600 hover:bg-yellow-700"
                  : "bg-zinc-700 hover:bg-zinc-600"
              } disabled:bg-zinc-600 disabled:cursor-not-allowed`}
              title={`Save to ${selectedGenerator}/config/`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </button>
          )}

          <button
            onClick={runOcr}
            disabled={!hasOcrElements || isRunningOcr}
            className={`px-3 py-1.5 rounded text-sm font-medium min-w-[60px] ${
              ocrPending
                ? "bg-yellow-600 hover:bg-yellow-700 animate-pulse"
                : hasOcrElements
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-zinc-600 cursor-not-allowed"
            } disabled:bg-zinc-600 disabled:cursor-not-allowed disabled:animate-none`}
          >
            {isRunningOcr ? "OCR..." : "OCR"}
          </button>

          <button
            onClick={() => setShowDataTypesModal(true)}
            className="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded text-sm font-medium"
            title="Extract data types from images"
          >
            Data Types
          </button>

          <button
            onClick={downloadZip}
            disabled={annotation.elements.length === 0 || isExporting || ocrPending || isRunningOcr}
            className={`${
              selectedGenerator
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-green-600 hover:bg-green-700"
            } disabled:bg-zinc-600 disabled:cursor-not-allowed px-3 py-1.5 rounded text-sm font-medium min-w-[110px]`}
            title={ocrPending ? "Run OCR first" : selectedGenerator ? `Save to ${selectedGenerator}` : undefined}
          >
            {isExporting
              ? (exportStatus || "Exporting...")
              : selectedGenerator
              ? "Save"
              : "Download ZIP"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - tools */}
        <aside className="w-56 bg-zinc-800 border-r border-zinc-700 flex flex-col">
          <div className="p-3 border-b border-zinc-700">
            <h3 className="text-sm font-semibold mb-2">Draw Mode</h3>
            <div className="flex gap-2">
              <button
                onClick={() => tools.setDrawMode("single")}
                className={`flex-1 px-2 py-1.5 rounded text-sm ${
                  tools.drawMode === "single"
                    ? "bg-blue-600"
                    : "bg-zinc-700 hover:bg-zinc-600"
                }`}
              >
                Single
              </button>
              <button
                onClick={() => tools.setDrawMode("grid")}
                className={`flex-1 px-2 py-1.5 rounded text-sm ${
                  tools.drawMode === "grid"
                    ? "bg-blue-600"
                    : "bg-zinc-700 hover:bg-zinc-600"
                }`}
              >
                Grid
              </button>
            </div>

            {tools.drawMode === "grid" && (
              <div className="mt-2 flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-zinc-400">Rows</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={tools.gridRows}
                    onChange={(e) => handleGridRowsChange(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-400">Cols</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={tools.gridCols}
                    onChange={(e) => handleGridColsChange(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-b border-zinc-700">
            <h3 className="text-sm font-semibold mb-2">Tools</h3>
            <button
              onClick={() => {
                if (tools.isCropMode) {
                  tools.stopCropMode();
                  setCropRect(null);
                } else {
                  tools.startCropMode();
                }
              }}
              className={`w-full px-2 py-1.5 rounded text-xs text-left flex items-center gap-1.5 ${
                tools.isCropMode
                  ? "ring-2 ring-orange-500 bg-orange-600/30"
                  : "bg-zinc-700 hover:bg-zinc-600"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Crop Tool
            </button>
          </div>

          <div className="p-3 border-b border-zinc-700">
            <h3 className="text-sm font-semibold mb-2">Element Type</h3>
            <div className="grid grid-cols-2 gap-1">
              {ELEMENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    tools.setCurrentType(t.value);
                    if (tools.isCropMode) {
                      tools.stopCropMode();
                      setCropRect(null);
                    }
                  }}
                  className={`px-2 py-1.5 rounded text-xs text-left flex items-center gap-1.5 ${
                    tools.currentType === t.value && !tools.isCropMode
                      ? "ring-2 ring-blue-500 bg-zinc-700"
                      : "bg-zinc-700 hover:bg-zinc-600"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {image.imageSize && (
            <div className="p-3 text-xs text-zinc-400 border-b border-zinc-700">
              <div>Image: {image.imageSize[0]} x {image.imageSize[1]}</div>
              <div className="truncate">File: {image.imagePath}</div>
            </div>
          )}

          <div className="p-3 text-xs text-zinc-500">
            <p className="mb-1"><strong>Tips:</strong></p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Drag & drop image to load</li>
              <li>Click & drag to draw bbox</li>
              <li>Click element to select</li>
              <li>Shift+click to draw over existing</li>
              <li>Use Grid mode for lists</li>
            </ul>
          </div>
        </aside>

        {/* Canvas area */}
        <main className="flex-1 bg-zinc-950 relative">
          {!image.imageUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
              <div className="border-2 border-dashed border-zinc-700 rounded-lg p-12 text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium">Drop image or ZIP here</p>
                <p className="text-sm mt-1">PNG, JPG, or exported .zip</p>
              </div>
            </div>
          ) : (
            <>
              <AnnotationCanvas
                imageUrl={image.imageUrl}
                imageSize={image.imageSize}
                elements={annotation.elements}
                selectedElementId={annotation.selectedElementId}
                onElementsChange={annotation.setElements}
                onSelectElement={annotation.selectElement}
                onElementCreated={annotation.autoGenerateTasks}
                currentType={tools.currentType}
                drawMode={tools.drawMode}
                gridRows={tools.gridRows}
                gridCols={tools.gridCols}
                isColorSampling={tools.isColorSampling}
                onColorSampled={handleColorSampled}
                zoomLevel={view.zoomLevel}
                isCropMode={tools.isCropMode}
                cropRect={cropRect}
                onCropRectChange={setCropRect}
                isIconPlacementMode={tools.isIconPlacementMode}
                onIconPlaced={handleIconPlaced}
              />
              {/* Crop controls */}
              {tools.isCropMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-800/95 rounded-lg px-4 py-2 shadow-lg border border-orange-500/50">
                  <span className="text-sm text-orange-400 font-medium">Crop Mode</span>
                  {cropRect && cropRect.width >= 10 && cropRect.height >= 10 && (
                    <>
                      <span className="text-xs text-zinc-400">
                        {Math.round(cropRect.width)} x {Math.round(cropRect.height)}
                      </span>
                      <button
                        onClick={handleApplyCrop}
                        className="bg-orange-600 hover:bg-orange-700 text-white rounded px-3 py-1 text-sm font-medium"
                      >
                        Apply Crop
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      tools.stopCropMode();
                      setCropRect(null);
                    }}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white rounded px-3 py-1 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {/* Zoom controls */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-zinc-800/90 rounded-lg px-3 py-2 shadow-lg">
                <button
                  onClick={view.zoomOut}
                  className="w-7 h-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded text-lg font-bold"
                >
                  -
                </button>
                <button
                  onClick={view.resetZoom}
                  className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded min-w-[50px]"
                >
                  {Math.round(view.zoomLevel * 100)}%
                </button>
                <button
                  onClick={view.zoomIn}
                  className="w-7 h-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded text-lg font-bold"
                >
                  +
                </button>
              </div>
            </>
          )}
        </main>

        {/* Right sidebars - elements and tasks */}
        <aside className={`bg-zinc-800 border-l border-zinc-700 flex flex-col ${view.elementsCollapsed ? "w-10" : "w-64"}`}>
          <button
            onClick={view.toggleElementsCollapsed}
            className="flex items-center justify-between px-3 py-2 bg-zinc-750 hover:bg-zinc-700 border-b border-zinc-700"
          >
            {!view.elementsCollapsed && <span className="text-sm font-semibold">Elements ({annotation.elements.length})</span>}
            <svg
              className={`w-4 h-4 transition-transform ${view.elementsCollapsed ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {!view.elementsCollapsed && (
            <div className="flex-1 overflow-hidden">
              <ElementList
                elements={annotation.elements}
                selectedElementId={annotation.selectedElementId}
                onSelectElement={annotation.selectElement}
                onUpdateElement={annotation.updateElement}
                onDeleteElement={annotation.deleteElement}
                onStartColorSampling={tools.startColorSampling}
                onUpdateGridTasks={annotation.updateGridTasks}
                isIconPlacementMode={tools.isIconPlacementMode}
                onToggleIconPlacementMode={() => {
                  if (tools.isIconPlacementMode) {
                    tools.stopIconPlacementMode();
                  } else {
                    tools.startIconPlacementMode();
                  }
                }}
              />
            </div>
          )}
        </aside>

        <aside className={`bg-zinc-800 border-l border-zinc-700 flex flex-col ${view.tasksCollapsed ? "w-10" : "w-64"}`}>
          <button
            onClick={view.toggleTasksCollapsed}
            className="flex items-center justify-between px-3 py-2 bg-zinc-750 hover:bg-zinc-700 border-b border-zinc-700"
          >
            {!view.tasksCollapsed && <span className="text-sm font-semibold">Tasks ({annotation.tasks.length})</span>}
            <svg
              className={`w-4 h-4 transition-transform ${view.tasksCollapsed ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {!view.tasksCollapsed && (
            <div className="flex-1 overflow-hidden">
              <TaskList
                tasks={annotation.tasks}
                elements={annotation.elements}
                selectedTaskId={annotation.selectedTaskId}
                onSelectTask={annotation.selectTask}
                onAddTask={annotation.addTask}
                onUpdateTask={annotation.updateTask}
                onDeleteTask={annotation.deleteTask}
              />
            </div>
          )}
        </aside>
      </div>

      {/* Data Types Modal */}
      <DataTypesModal
        isOpen={showDataTypesModal}
        onClose={() => setShowDataTypesModal(false)}
        dataTypes={dataTypes}
      />
    </div>
  );
}
