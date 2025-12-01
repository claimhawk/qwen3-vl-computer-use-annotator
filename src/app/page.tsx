"use client";

import { useState, useCallback, useEffect, DragEvent } from "react";
import JSZip from "jszip";
import AnnotationCanvas from "@/components/AnnotationCanvas";
import ElementList from "@/components/ElementList";
import TaskList from "@/components/TaskList";
import {
  UIElement,
  ElementType,
  Annotation,
  Task,
  ELEMENT_TYPES,
  getElementColor,
} from "@/types/annotation";

// Helper to get grid cell positions based on custom or uniform sizes
function getGridPositions(el: UIElement) {
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

  return { colPositions, rowPositions };
}

export default function Home() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<[number, number] | null>(null);
  const [imagePath, setImagePath] = useState<string>("");
  const [elements, setElements] = useState<UIElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState<ElementType>("button");
  const [screenName, setScreenName] = useState<string>("untitled_screen");
  const [drawMode, setDrawMode] = useState<"single" | "grid">("single");
  const [gridRows, setGridRows] = useState(1);
  const [gridCols, setGridCols] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isColorSampling, setIsColorSampling] = useState(false);
  const [elementsCollapsed, setElementsCollapsed] = useState(false);
  const [tasksCollapsed, setTasksCollapsed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit, >1 = zoom in

  // Sync grid rows/cols from selected element
  useEffect(() => {
    if (selectedElementId) {
      const el = elements.find((el) => el.id === selectedElementId);
      if (el && ["grid", "icon", "dropdown", "listbox"].includes(el.type)) {
        setGridRows(el.rows ?? 1);
        setGridCols(el.cols ?? 1);
      }
    }
  }, [selectedElementId, elements]);

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;

    setImagePath(file.name);
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
    setScreenName(baseName);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageSize([img.width, img.height]);
      setImageUrl(url);
      setElements([]);
      setSelectedElementId(null);
      setTasks([]);
      setSelectedTaskId(null);
    };
    img.src = url;
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".zip")) {
      // Load ZIP file
      try {
        const zip = await JSZip.loadAsync(file);

        // Load annotation.json
        const annotationFile = zip.file("annotation.json");
        if (annotationFile) {
          const annotationText = await annotationFile.async("string");
          const annotation: Annotation = JSON.parse(annotationText);
          setScreenName(annotation.screenName);
          setElements([...annotation.elements]);
          setImageSize([...annotation.imageSize]);
          setTasks([...(annotation.tasks || [])]);
          setSelectedTaskId(null);
          if (annotation.imagePath) {
            setImagePath(annotation.imagePath);
          }
        }

        // Load original.png as the image
        const imageFile = zip.file("original.png");
        if (imageFile) {
          const imageBlob = await imageFile.async("blob");
          const url = URL.createObjectURL(imageBlob);
          setImageUrl(url);
        }
      } catch (err) {
        alert("Failed to load ZIP file");
        console.error(err);
      }
    } else if (file.type.startsWith("image/")) {
      loadImageFile(file);
    }
  }, [loadImageFile]);

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
    // Only set dragging to false if we're leaving the container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleUpdateElement = useCallback(
    (id: string, updates: Partial<UIElement>) => {
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
      );
    },
    []
  );

  const handleDeleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedElementId(null);
  }, []);

  const handleCropToElement = useCallback((id: string) => {
    const element = elements.find((el) => el.id === id);
    if (!element || !imageUrl || !imageSize) return;

    const cropBbox = element.bbox;

    // Create a canvas to crop the image
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = cropBbox.width;
      canvas.height = cropBbox.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw cropped region
      ctx.drawImage(
        img,
        cropBbox.x, cropBbox.y, cropBbox.width, cropBbox.height,
        0, 0, cropBbox.width, cropBbox.height
      );

      // Create new image URL
      const newImageUrl = canvas.toDataURL("image/png");
      setImageUrl(newImageUrl);
      setImageSize([cropBbox.width, cropBbox.height]);

      // Adjust all elements that are inside the crop region
      setElements((prev) => {
        const adjusted: UIElement[] = [];
        for (const el of prev) {
          // Skip the crop element itself
          if (el.id === id) continue;

          // Check if element is inside crop region
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
            // Element is inside - adjust coordinates
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

      setSelectedElementId(null);
      setScreenName((prev) => prev + "_cropped");
    };
    img.src = imageUrl;
  }, [elements, imageUrl, imageSize]);

  const handleAddTask = useCallback(() => {
    const newTask: Task = {
      id: `task_${Date.now()}`,
      prompt: "",
      targetElementId: "",
    };
    setTasks((prev) => [...prev, newTask]);
    setSelectedTaskId(newTask.id);
  }, []);

  const handleUpdateTask = useCallback(
    (id: string, updates: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const handleDeleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTaskId(null);
  }, []);

  const handleStartColorSampling = useCallback(() => {
    setIsColorSampling(true);
  }, []);

  const handleColorSampled = useCallback(
    (color: string) => {
      if (selectedElementId) {
        handleUpdateElement(selectedElementId, { maskColor: color });
      }
      setIsColorSampling(false);
    },
    [selectedElementId, handleUpdateElement]
  );

  const downloadZip = async () => {
    if (!imageSize || !imageUrl) return;

    const zip = new JSZip();

    // 1. Add annotation JSON
    const annotation: Annotation = {
      screenName,
      imageSize,
      imagePath,
      elements,
      tasks,
      metadata: {
        sourceApp: "",
        screenType: "",
      },
    };
    zip.file("annotation.json", JSON.stringify(annotation, null, 2));

    // 2. Add original image (without annotations)
    const img = new Image();
    img.src = imageUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    const canvas = document.createElement("canvas");
    canvas.width = imageSize[0];
    canvas.height = imageSize[1];
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw original image
    ctx.drawImage(img, 0, 0);
    const originalBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (originalBlob) {
      zip.file("original.png", originalBlob);
    }

    // 3. Add masked image (regions filled with background color for templating)
    // Reset canvas to original
    ctx.drawImage(img, 0, 0);

    // Only mask elements that have mask enabled (defaults to true for maskable types)
    const maskableTypes = ["textinput", "dropdown", "listbox", "grid", "icon", "panel", "toolbar", "menubar", "text", "mask"];

    // Fill annotated regions with background color
    elements.forEach((el) => {
      // Skip if not maskable type or mask is explicitly disabled
      if (!maskableTypes.includes(el.type)) return;
      if (el.mask === false) return;
      // Skip if no mask color set - require explicit sampling
      if (!el.maskColor) return;

      // Fill the region with sampled color
      ctx.fillStyle = el.maskColor;
      ctx.fillRect(el.bbox.x, el.bbox.y, el.bbox.width, el.bbox.height);

      // Only draw grid lines for actual grid elements, not dropdowns/listboxes
      // (those should be masked as a solid region)
      if (el.type === "grid") {
        const rows = el.rows || 1;
        const cols = el.cols || 1;
        if (rows > 1 || cols > 1) {
          const { colPositions, rowPositions } = getGridPositions(el);
          ctx.strokeStyle = "rgba(128, 128, 128, 0.4)";
          ctx.lineWidth = 1;
          for (const rowY of rowPositions) {
            ctx.beginPath();
            ctx.moveTo(el.bbox.x, rowY);
            ctx.lineTo(el.bbox.x + el.bbox.width, rowY);
            ctx.stroke();
          }
          for (const colX of colPositions) {
            ctx.beginPath();
            ctx.moveTo(colX, el.bbox.y);
            ctx.lineTo(colX, el.bbox.y + el.bbox.height);
            ctx.stroke();
          }
        }
      }
    });

    const maskedBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (maskedBlob) {
      zip.file("masked.png", maskedBlob);
    }

    // 4. Add annotated image (with bboxes)
    // Reset and redraw original
    ctx.drawImage(img, 0, 0);
    // Draw elements on top
    elements.forEach((el) => {
      const color = getElementColor(el.type);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(el.bbox.x, el.bbox.y, el.bbox.width, el.bbox.height);

      // Label
      ctx.fillStyle = color;
      ctx.font = "12px sans-serif";
      const label = el.text ? `${el.type}: ${el.text}` : el.type;
      ctx.fillText(label, el.bbox.x + 2, el.bbox.y - 4);

      // Semi-transparent fill
      ctx.fillStyle = color + "30";
      ctx.fillRect(el.bbox.x, el.bbox.y, el.bbox.width, el.bbox.height);

      // Division lines
      const rows = el.rows || 1;
      const cols = el.cols || 1;
      if (rows > 1 || cols > 1) {
        const { colPositions, rowPositions } = getGridPositions(el);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (const rowY of rowPositions) {
          ctx.beginPath();
          ctx.moveTo(el.bbox.x, rowY);
          ctx.lineTo(el.bbox.x + el.bbox.width, rowY);
          ctx.stroke();
        }
        for (const colX of colPositions) {
          ctx.beginPath();
          ctx.moveTo(colX, el.bbox.y);
          ctx.lineTo(colX, el.bbox.y + el.bbox.height);
          ctx.stroke();
        }
      }
    });

    const annotatedBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (annotatedBlob) {
      zip.file("annotated.png", annotatedBlob);
    }

    // 5. Export icons/panels with exportIcon=true
    const iconsToExport = elements.filter((el) => (el.type === "icon" || el.type === "panel" || el.type === "toolbar" || el.type === "menubar") && el.exportIcon);
    if (iconsToExport.length > 0) {
      const iconsFolder = zip.folder("icons");
      if (iconsFolder) {
        for (const iconEl of iconsToExport) {
          const rows = iconEl.rows || 1;
          const cols = iconEl.cols || 1;
          const baseName = iconEl.text || iconEl.id;

          // If grid (rows/cols > 1), slice into individual icons
          if (rows > 1 || cols > 1) {
            const { colPositions, rowPositions } = getGridPositions(iconEl);
            // Build cell bounds arrays
            const colBounds = [iconEl.bbox.x, ...colPositions, iconEl.bbox.x + iconEl.bbox.width];
            const rowBounds = [iconEl.bbox.y, ...rowPositions, iconEl.bbox.y + iconEl.bbox.height];

            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const srcX = colBounds[c];
                const srcY = rowBounds[r];
                const cellW = colBounds[c + 1] - colBounds[c];
                const cellH = rowBounds[r + 1] - rowBounds[r];

                const iconCanvas = document.createElement("canvas");
                iconCanvas.width = Math.round(cellW);
                iconCanvas.height = Math.round(cellH);
                const iconCtx = iconCanvas.getContext("2d");
                if (!iconCtx) continue;

                iconCtx.drawImage(
                  img,
                  srcX, srcY, cellW, cellH,
                  0, 0, cellW, cellH
                );

                const idx = r * cols + c + 1;
                const iconBlob = await new Promise<Blob | null>((resolve) =>
                  iconCanvas.toBlob(resolve, "image/png")
                );
                if (iconBlob) {
                  iconsFolder.file(`${baseName}_${idx}.png`, iconBlob);
                }
              }
            }
          } else {
            // Single icon - export as-is
            const iconCanvas = document.createElement("canvas");
            iconCanvas.width = iconEl.bbox.width;
            iconCanvas.height = iconEl.bbox.height;
            const iconCtx = iconCanvas.getContext("2d");
            if (!iconCtx) continue;

            iconCtx.drawImage(
              img,
              iconEl.bbox.x, iconEl.bbox.y, iconEl.bbox.width, iconEl.bbox.height,
              0, 0, iconEl.bbox.width, iconEl.bbox.height
            );

            const iconBlob = await new Promise<Blob | null>((resolve) =>
              iconCanvas.toBlob(resolve, "image/png")
            );
            if (iconBlob) {
              iconsFolder.file(`${baseName}.png`, iconBlob);
            }
          }
        }
      }
    }

    // Generate and download zip
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${screenName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadAnnotation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".zip")) {
      // Load ZIP file
      try {
        const zip = await JSZip.loadAsync(file);

        // Load annotation.json
        const annotationFile = zip.file("annotation.json");
        if (annotationFile) {
          const annotationText = await annotationFile.async("string");
          const annotation: Annotation = JSON.parse(annotationText);
          setScreenName(annotation.screenName);
          setElements([...annotation.elements]);
          setImageSize([...annotation.imageSize]);
          setTasks([...(annotation.tasks || [])]);
          setSelectedTaskId(null);
          if (annotation.imagePath) {
            setImagePath(annotation.imagePath);
          }
        }

        // Load original.png as the image
        const imageFile = zip.file("original.png");
        if (imageFile) {
          const imageBlob = await imageFile.async("blob");
          const url = URL.createObjectURL(imageBlob);
          setImageUrl(url);
        }
      } catch (err) {
        alert("Failed to load ZIP file");
        console.error(err);
      }
    } else {
      // Load JSON file
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const annotation: Annotation = JSON.parse(event.target?.result as string);
          setScreenName(annotation.screenName);
          setElements([...annotation.elements]);
          setImageSize([...annotation.imageSize]);
          setTasks([...(annotation.tasks || [])]);
          setSelectedTaskId(null);
          if (annotation.imagePath) {
            setImagePath(annotation.imagePath);
          }
        } catch (err) {
          alert("Failed to parse annotation file");
          console.error(err);
        }
      };
      reader.readAsText(file);
    }
  };

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
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
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
              onChange={loadAnnotation}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
          <button
            onClick={downloadZip}
            disabled={elements.length === 0}
            className="bg-green-600 hover:bg-green-700 disabled:bg-zinc-600 disabled:cursor-not-allowed px-3 py-1.5 rounded text-sm font-medium"
          >
            Download ZIP
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
                onClick={() => setDrawMode("single")}
                className={`flex-1 px-2 py-1.5 rounded text-sm ${
                  drawMode === "single"
                    ? "bg-blue-600"
                    : "bg-zinc-700 hover:bg-zinc-600"
                }`}
              >
                Single
              </button>
              <button
                onClick={() => setDrawMode("grid")}
                className={`flex-1 px-2 py-1.5 rounded text-sm ${
                  drawMode === "grid"
                    ? "bg-blue-600"
                    : "bg-zinc-700 hover:bg-zinc-600"
                }`}
              >
                Grid
              </button>
            </div>

            {drawMode === "grid" && (
              <div className="mt-2 flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-zinc-400">Rows</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={gridRows}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setGridRows(val);
                      // Also update selected element if it's a grid-type
                      if (selectedElementId) {
                        const el = elements.find((el) => el.id === selectedElementId);
                        if (el && ["grid", "icon", "dropdown", "listbox"].includes(el.type)) {
                          handleUpdateElement(selectedElementId, { rows: val });
                        }
                      }
                    }}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-400">Cols</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={gridCols}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setGridCols(val);
                      // Also update selected element if it's a grid-type
                      if (selectedElementId) {
                        const el = elements.find((el) => el.id === selectedElementId);
                        if (el && ["grid", "icon"].includes(el.type)) {
                          handleUpdateElement(selectedElementId, { cols: val });
                        }
                      }
                    }}
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
                  onClick={() => setCurrentType(t.value)}
                  className={`px-2 py-1.5 rounded text-xs text-left flex items-center gap-1.5 ${
                    currentType === t.value
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

          {imageSize && (
            <div className="p-3 text-xs text-zinc-400 border-b border-zinc-700">
              <div>Image: {imageSize[0]} × {imageSize[1]}</div>
              <div className="truncate">File: {imagePath}</div>
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
          {!imageUrl ? (
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
                imageUrl={imageUrl}
                imageSize={imageSize}
                elements={elements}
                selectedElementId={selectedElementId}
                onElementsChange={setElements}
                onSelectElement={setSelectedElementId}
                currentType={currentType}
                drawMode={drawMode}
                gridRows={gridRows}
                gridCols={gridCols}
                isColorSampling={isColorSampling}
                onColorSampled={handleColorSampled}
                zoomLevel={zoomLevel}
              />
              {/* Zoom controls */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-zinc-800/90 rounded-lg px-3 py-2 shadow-lg">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.25, z - 0.25))}
                  className="w-7 h-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded text-lg font-bold"
                >
                  −
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded min-w-[50px]"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(4, z + 0.25))}
                  className="w-7 h-7 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded text-lg font-bold"
                >
                  +
                </button>
              </div>
            </>
          )}
        </main>

        {/* Right sidebars - elements and tasks side by side */}
        <aside className={`bg-zinc-800 border-l border-zinc-700 flex flex-col ${elementsCollapsed ? "w-10" : "w-64"}`}>
          <button
            onClick={() => setElementsCollapsed(!elementsCollapsed)}
            className="flex items-center justify-between px-3 py-2 bg-zinc-750 hover:bg-zinc-700 border-b border-zinc-700"
          >
            {!elementsCollapsed && <span className="text-sm font-semibold">Elements ({elements.length})</span>}
            <svg
              className={`w-4 h-4 transition-transform ${elementsCollapsed ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {!elementsCollapsed && (
            <div className="flex-1 overflow-hidden">
              <ElementList
                elements={elements}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onCropToElement={handleCropToElement}
                onStartColorSampling={handleStartColorSampling}
              />
            </div>
          )}
        </aside>

        <aside className={`bg-zinc-800 border-l border-zinc-700 flex flex-col ${tasksCollapsed ? "w-10" : "w-64"}`}>
          <button
            onClick={() => setTasksCollapsed(!tasksCollapsed)}
            className="flex items-center justify-between px-3 py-2 bg-zinc-750 hover:bg-zinc-700 border-b border-zinc-700"
          >
            {!tasksCollapsed && <span className="text-sm font-semibold">Tasks ({tasks.length})</span>}
            <svg
              className={`w-4 h-4 transition-transform ${tasksCollapsed ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {!tasksCollapsed && (
            <div className="flex-1 overflow-hidden">
              <TaskList
                tasks={tasks}
                elements={elements}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
