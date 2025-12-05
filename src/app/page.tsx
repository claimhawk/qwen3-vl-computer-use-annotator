"use client";

import { useState, useCallback, useEffect, DragEvent } from "react";
import AnnotationCanvas from "@/components/AnnotationCanvas";
import ElementList from "@/components/ElementList";
import TaskList from "@/components/TaskList";
import { GenerateButton } from "@/components/GenerateButton";
import {
  ElementType,
  ELEMENT_TYPES,
} from "@/types/annotation";

// Custom hooks
import {
  useAnnotationState,
  useImageState,
  useToolState,
  useViewState,
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

  // Drag-drop state (kept local as it's UI-only)
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isRunningOcr, setIsRunningOcr] = useState(false);

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

  // Handle crop to element
  const handleCropToElement = useCallback(async (id: string) => {
    const element = annotation.elements.find((el) => el.id === id);
    if (!element || !image.imageUrl || !image.imageSize) return;

    const cropBbox = element.bbox;

    // Crop the image
    await image.cropToRegion(cropBbox);

    // Adjust elements inside the crop region
    annotation.setElements((prev) => {
      const adjusted = [];
      for (const el of prev) {
        if (el.id === id) continue;

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
  }, [annotation, image]);

  // Handle color sampling
  const handleColorSampled = useCallback((color: string) => {
    if (annotation.selectedElementId) {
      annotation.updateElement(annotation.selectedElementId, { maskColor: color });
    }
    tools.stopColorSampling();
  }, [annotation, tools]);

  // Handle download ZIP
  const downloadZip = useCallback(async () => {
    if (!image.imageSize || !image.imageUrl) return;

    setIsExporting(true);
    setExportStatus("Preparing...");

    try {
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

      setExportStatus("Downloading...");
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${image.screenName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to create ZIP");
      console.error(err);
    } finally {
      setIsExporting(false);
      setExportStatus(null);
    }
  }, [image, annotation]);

  // Handle import
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Handle grid row/col changes that also update selected element
  const handleGridRowsChange = useCallback((val: number) => {
    tools.setGridRows(val);
    if (annotation.selectedElementId) {
      const el = annotation.elements.find((e) => e.id === annotation.selectedElementId);
      if (el && isGridType(el.type)) {
        annotation.updateElement(annotation.selectedElementId, { rows: val });
      }
    }
  }, [tools, annotation]);

  const handleGridColsChange = useCallback((val: number) => {
    tools.setGridCols(val);
    if (annotation.selectedElementId) {
      const el = annotation.elements.find((e) => e.id === annotation.selectedElementId);
      if (el && ["grid", "icon"].includes(el.type)) {
        annotation.updateElement(annotation.selectedElementId, { cols: val });
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
          <label className="relative cursor-pointer bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded text-sm">
            Import
            <input
              type="file"
              accept=".json,.zip"
              onChange={handleImport}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
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
            onClick={downloadZip}
            disabled={annotation.elements.length === 0 || isExporting || ocrPending || isRunningOcr}
            className="bg-green-600 hover:bg-green-700 disabled:bg-zinc-600 disabled:cursor-not-allowed px-3 py-1.5 rounded text-sm font-medium min-w-[110px]"
            title={ocrPending ? "Run OCR first" : undefined}
          >
            {isExporting ? (exportStatus || "Exporting...") : "Download ZIP"}
          </button>
          <GenerateButton
            screenName={image.screenName}
            imageSize={image.imageSize}
            imagePath={image.imagePath}
            imageUrl={image.imageUrl}
            elements={annotation.elements}
            tasks={annotation.tasks}
            disabled={annotation.elements.length === 0 || ocrPending || isRunningOcr}
          />
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
            <h3 className="text-sm font-semibold mb-2">Element Type</h3>
            <div className="grid grid-cols-2 gap-1">
              {ELEMENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => tools.setCurrentType(t.value)}
                  className={`px-2 py-1.5 rounded text-xs text-left flex items-center gap-1.5 ${
                    tools.currentType === t.value
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
              />
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
                onCropToElement={handleCropToElement}
                onStartColorSampling={tools.startColorSampling}
                onUpdateGridTasks={annotation.updateGridTasks}
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
    </div>
  );
}
