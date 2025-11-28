"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { UIElement, BBox, ElementType, getElementColor } from "@/types/annotation";

interface Props {
  imageUrl: string | null;
  imageSize: [number, number] | null;
  elements: UIElement[];
  selectedElementId: string | null;
  onElementsChange: (elements: UIElement[]) => void;
  onSelectElement: (id: string | null) => void;
  currentType: ElementType;
  drawMode: "single" | "grid";
  gridRows: number;
  gridCols: number;
  isColorSampling?: boolean;
  onColorSampled?: (color: string) => void;
  zoomLevel?: number;
}

export default function AnnotationCanvas({
  imageUrl,
  imageSize,
  elements,
  selectedElementId,
  onElementsChange,
  onSelectElement,
  currentType,
  drawMode,
  gridRows,
  gridCols,
  isColorSampling,
  onColorSampled,
  zoomLevel = 1,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<BBox | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [resizeEdge, setResizeEdge] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; bbox: BBox } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);

  // Edge detection threshold in pixels
  const EDGE_THRESHOLD = 8;

  // Effective scale with zoom
  const scale = baseScale * zoomLevel;

  // Calculate base scale to fit image in container
  useEffect(() => {
    if (!imageSize || !containerRef.current) return;
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const scaleX = containerWidth / imageSize[0];
    const scaleY = containerHeight / imageSize[1];
    const newBaseScale = Math.min(scaleX, scaleY, 1); // Don't scale up
    setBaseScale(newBaseScale);
    setPan({ x: 0, y: 0 }); // Reset pan when image changes
  }, [imageSize]);

  // Reset pan when zoom returns to 1 (fit)
  useEffect(() => {
    if (zoomLevel === 1) {
      setPan({ x: 0, y: 0 });
    }
  }, [zoomLevel]);

  // Calculate offset based on zoom and pan
  useEffect(() => {
    if (!imageSize || !containerRef.current) return;
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    setOffset({
      x: (containerWidth - imageSize[0] * scale) / 2 + pan.x,
      y: (containerHeight - imageSize[1] * scale) / 2 + pan.y,
    });
  }, [imageSize, scale, pan]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl || !imageSize) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Set canvas size to container size
      if (containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
      }

      // Clear and draw background
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw image scaled
      ctx.drawImage(
        img,
        offset.x,
        offset.y,
        imageSize[0] * scale,
        imageSize[1] * scale
      );

      // Draw existing elements (hide when color sampling)
      if (!isColorSampling) {
      elements.forEach((el) => {
        const color = getElementColor(el.type);
        const isSelected = el.id === selectedElementId;

        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.setLineDash(isSelected ? [] : [5, 3]);

        const x = offset.x + el.bbox.x * scale;
        const y = offset.y + el.bbox.y * scale;
        const w = el.bbox.width * scale;
        const h = el.bbox.height * scale;

        ctx.strokeRect(x, y, w, h);

        // Draw label
        ctx.fillStyle = color;
        ctx.font = "12px sans-serif";
        const label = el.text ? `${el.type}: ${el.text}` : el.type;
        ctx.fillText(label, x + 2, y - 4);

        // Fill with transparent color
        ctx.fillStyle = color + "20";
        ctx.fillRect(x, y, w, h);

        // Draw division lines if rows/cols are set
        const rows = el.rows || 1;
        const cols = el.cols || 1;
        if (rows > 1 || cols > 1) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);

          const cellHeight = h / rows;
          const cellWidth = w / cols;

          // Draw horizontal division lines
          for (let r = 1; r < rows; r++) {
            ctx.beginPath();
            ctx.moveTo(x, y + r * cellHeight);
            ctx.lineTo(x + w, y + r * cellHeight);
            ctx.stroke();
          }

          // Draw vertical division lines
          for (let c = 1; c < cols; c++) {
            ctx.beginPath();
            ctx.moveTo(x + c * cellWidth, y);
            ctx.lineTo(x + c * cellWidth, y + h);
            ctx.stroke();
          }

          // Draw cell numbers with background for visibility
          ctx.font = "bold 11px sans-serif";
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const cellX = x + c * cellWidth;
              const cellY = y + r * cellHeight;
              const cellNum = String(r * cols + c + 1);
              // Dark background pill
              const textWidth = ctx.measureText(cellNum).width;
              ctx.fillStyle = "rgba(0,0,0,0.7)";
              ctx.fillRect(cellX + 2, cellY + 2, textWidth + 6, 14);
              // White text
              ctx.fillStyle = "#ffffff";
              ctx.fillText(cellNum, cellX + 5, cellY + 13);
            }
          }
        }
      });
      } // end if !isColorSampling

      // Draw current rectangle being drawn (also hide when sampling)
      if (currentRect && !isColorSampling) {
        ctx.strokeStyle = getElementColor(currentType);
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        const x = offset.x + currentRect.x * scale;
        const y = offset.y + currentRect.y * scale;
        const w = currentRect.width * scale;
        const h = currentRect.height * scale;

        ctx.strokeRect(x, y, w, h);

        // If grid mode, show grid preview
        if (drawMode === "grid" && gridRows > 1) {
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = "#ffffff80";
          const rowHeight = h / gridRows;
          const colWidth = w / gridCols;

          for (let r = 1; r < gridRows; r++) {
            ctx.beginPath();
            ctx.moveTo(x, y + r * rowHeight);
            ctx.lineTo(x + w, y + r * rowHeight);
            ctx.stroke();
          }
          for (let c = 1; c < gridCols; c++) {
            ctx.beginPath();
            ctx.moveTo(x + c * colWidth, y);
            ctx.lineTo(x + c * colWidth, y + h);
            ctx.stroke();
          }
        }
      }
    };
    img.src = imageUrl;
  }, [imageUrl, imageSize, elements, selectedElementId, currentRect, scale, offset, currentType, drawMode, gridRows, gridCols, isColorSampling]);

  // Convert screen coords to image coords
  const screenToImage = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = (screenX - rect.left - offset.x) / scale;
      const y = (screenY - rect.top - offset.y) / scale;
      return { x: Math.round(x), y: Math.round(y) };
    },
    [scale, offset]
  );

  // Detect which edge of selected element mouse is near
  const detectEdge = useCallback(
    (pos: { x: number; y: number }): string | null => {
      if (!selectedElementId) return null;
      const el = elements.find((e) => e.id === selectedElementId);
      if (!el) return null;

      const threshold = EDGE_THRESHOLD / scale;
      const { x, y, width, height } = el.bbox;
      const right = x + width;
      const bottom = y + height;

      const nearLeft = Math.abs(pos.x - x) < threshold;
      const nearRight = Math.abs(pos.x - right) < threshold;
      const nearTop = Math.abs(pos.y - y) < threshold;
      const nearBottom = Math.abs(pos.y - bottom) < threshold;
      const withinX = pos.x >= x - threshold && pos.x <= right + threshold;
      const withinY = pos.y >= y - threshold && pos.y <= bottom + threshold;

      if (nearTop && nearLeft && withinX && withinY) return "nw";
      if (nearBottom && nearRight && withinX && withinY) return "se";
      if (nearTop && nearRight && withinX && withinY) return "ne";
      if (nearBottom && nearLeft && withinX && withinY) return "sw";
      if (nearLeft && withinY) return "w";
      if (nearRight && withinY) return "e";
      if (nearTop && withinX) return "n";
      if (nearBottom && withinX) return "s";

      return null;
    },
    [selectedElementId, elements, scale]
  );

  // Get cursor style for edge
  const getCursorForEdge = (edge: string | null): string => {
    switch (edge) {
      case "n":
      case "s":
        return "ns-resize";
      case "e":
      case "w":
        return "ew-resize";
      case "nw":
      case "se":
        return "nwse-resize";
      case "ne":
      case "sw":
        return "nesw-resize";
      default:
        return "crosshair";
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageUrl) return;

    // Middle mouse button or space key held = start panning
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const pos = screenToImage(e.clientX, e.clientY);

    // Check for edge resize on selected element
    const edge = detectEdge(pos);
    if (edge && selectedElementId) {
      const el = elements.find((el) => el.id === selectedElementId);
      if (el) {
        setResizeEdge(edge);
        setResizeStart({ x: pos.x, y: pos.y, bbox: el.bbox });
        return;
      }
    }

    // Handle color sampling
    if (isColorSampling && onColorSampled) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Get pixel color at click position (in canvas coordinates)
      const canvasX = pos.x * scale + offset.x;
      const canvasY = pos.y * scale + offset.y;
      const pixel = ctx.getImageData(canvasX, canvasY, 1, 1).data;
      const color = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
      onColorSampled(color);
      return;
    }

    // Always start drawing - we'll check on mouseUp if it was a click or drag
    setIsDrawing(true);
    setStartPoint(pos);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!imageUrl) return;

    const pos = screenToImage(e.clientX, e.clientY);

    // Find smallest element at click position (most specific/inner element)
    let clickedElement: UIElement | null = null;
    let smallestArea = Infinity;

    elements.forEach((el) => {
      if (
        pos.x >= el.bbox.x &&
        pos.x <= el.bbox.x + el.bbox.width &&
        pos.y >= el.bbox.y &&
        pos.y <= el.bbox.y + el.bbox.height
      ) {
        const area = el.bbox.width * el.bbox.height;
        if (area < smallestArea) {
          smallestArea = area;
          clickedElement = el;
        }
      }
    });

    if (clickedElement) {
      onSelectElement(clickedElement.id);
    } else {
      onSelectElement(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle panning
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const pos = screenToImage(e.clientX, e.clientY);

    // Handle resizing
    if (resizeEdge && resizeStart && selectedElementId && imageSize) {
      const dx = pos.x - resizeStart.x;
      const dy = pos.y - resizeStart.y;
      const orig = resizeStart.bbox;
      let newBbox = { ...orig };

      const [imgW, imgH] = imageSize;

      switch (resizeEdge) {
        case "e":
          newBbox = { ...orig, width: Math.max(10, orig.width + dx) };
          break;
        case "w":
          newBbox = { ...orig, x: orig.x + dx, width: Math.max(10, orig.width - dx) };
          break;
        case "s":
          newBbox = { ...orig, height: Math.max(10, orig.height + dy) };
          break;
        case "n":
          newBbox = { ...orig, y: orig.y + dy, height: Math.max(10, orig.height - dy) };
          break;
        case "se":
          newBbox = { ...orig, width: Math.max(10, orig.width + dx), height: Math.max(10, orig.height + dy) };
          break;
        case "nw":
          newBbox = { ...orig, x: orig.x + dx, y: orig.y + dy, width: Math.max(10, orig.width - dx), height: Math.max(10, orig.height - dy) };
          break;
        case "ne":
          newBbox = { ...orig, y: orig.y + dy, width: Math.max(10, orig.width + dx), height: Math.max(10, orig.height - dy) };
          break;
        case "sw":
          newBbox = { ...orig, x: orig.x + dx, width: Math.max(10, orig.width - dx), height: Math.max(10, orig.height + dy) };
          break;
      }

      // Clamp to image bounds
      newBbox.x = Math.max(0, Math.min(newBbox.x, imgW - 10));
      newBbox.y = Math.max(0, Math.min(newBbox.y, imgH - 10));
      newBbox.width = Math.min(newBbox.width, imgW - newBbox.x);
      newBbox.height = Math.min(newBbox.height, imgH - newBbox.y);

      onElementsChange(
        elements.map((el) =>
          el.id === selectedElementId ? { ...el, bbox: newBbox } : el
        )
      );
      return;
    }

    // Update hover edge for cursor
    if (!isDrawing && !isColorSampling) {
      const edge = detectEdge(pos);
      setHoverEdge(edge);
    }

    if (!isDrawing || !startPoint || !imageSize) return;

    const [imgW, imgH] = imageSize;

    // Clamp position to image bounds
    const clampedX = Math.max(0, Math.min(pos.x, imgW));
    const clampedY = Math.max(0, Math.min(pos.y, imgH));

    const x = Math.min(startPoint.x, clampedX);
    const y = Math.min(startPoint.y, clampedY);
    const width = Math.abs(clampedX - startPoint.x);
    const height = Math.abs(clampedY - startPoint.y);

    setCurrentRect({ x, y, width, height });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Stop panning
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Stop resizing
    if (resizeEdge) {
      setResizeEdge(null);
      setResizeStart(null);
      return;
    }

    if (!isDrawing) {
      return;
    }

    // If no rect or very small, treat as click for selection
    if (!currentRect || (currentRect.width < 10 && currentRect.height < 10)) {
      setIsDrawing(false);
      setCurrentRect(null);
      setStartPoint(null);
      // Trigger click handler for selection
      handleClick(e);
      return;
    }

    if (drawMode === "grid" && (gridRows > 1 || gridCols > 1)) {
      // For icon/grid types, just create single element with rows/cols
      // For listbox/dropdown, create container + child cells
      const needsChildCells = currentType === "listbox" || currentType === "dropdown";

      if (needsChildCells) {
        const containerId = `el_${Date.now()}`;
        const cellWidth = currentRect.width / gridCols;
        const cellHeight = currentRect.height / gridRows;

        const containerElement: UIElement = {
          id: containerId,
          type: currentType,
          bbox: currentRect,
          text: currentType,
          rows: gridRows,
          cols: gridCols,
        };

        const cellElements: UIElement[] = [];
        for (let r = 0; r < gridRows; r++) {
          for (let c = 0; c < gridCols; c++) {
            cellElements.push({
              id: `${containerId}_r${r}_c${c}`,
              type: "label",
              bbox: {
                x: Math.round(currentRect.x + c * cellWidth),
                y: Math.round(currentRect.y + r * cellHeight),
                width: Math.round(cellWidth),
                height: Math.round(cellHeight),
              },
              text: `item_${r * gridCols + c + 1}`,
              parentId: containerId,
            });
          }
        }
        onElementsChange([...elements, containerElement, ...cellElements]);
        onSelectElement(containerId);
      } else {
        // Single element with rows/cols (for icon, grid, etc.)
        const newElement: UIElement = {
          id: `el_${Date.now()}`,
          type: currentType,
          bbox: currentRect,
          rows: gridRows,
          cols: gridCols,
        };
        onElementsChange([...elements, newElement]);
        onSelectElement(newElement.id);
      }
    } else {
      // Single element
      const newElement: UIElement = {
        id: `el_${Date.now()}`,
        type: currentType,
        bbox: currentRect,
      };
      onElementsChange([...elements, newElement]);
      onSelectElement(newElement.id);
    }

    setIsDrawing(false);
    setCurrentRect(null);
    setStartPoint(null);
  };

  // Determine cursor style
  const cursorStyle = isPanning
    ? "cursor-grabbing"
    : resizeEdge
    ? `cursor-${getCursorForEdge(resizeEdge)}`
    : isColorSampling
    ? "cursor-copy"
    : hoverEdge
    ? `cursor-${getCursorForEdge(hoverEdge)}`
    : "cursor-crosshair";

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0`}
        style={{ cursor: isPanning ? "grabbing" : resizeEdge ? getCursorForEdge(resizeEdge) : isColorSampling ? "copy" : hoverEdge ? getCursorForEdge(hoverEdge) : "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDrawing(false);
          setCurrentRect(null);
          setStartPoint(null);
          setIsPanning(false);
          setResizeEdge(null);
          setResizeStart(null);
          setHoverEdge(null);
        }}
      />
      {!imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
          Load an image to start annotating
        </div>
      )}
    </div>
  );
}
