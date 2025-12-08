"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { UIElement, BBox, ElementType, getElementColor, IconDefinition } from "@/types/annotation";
import { getGridPositions } from "@/utils/gridUtils";

interface Props {
  imageUrl: string | null;
  imageSize: [number, number] | null;
  elements: UIElement[];
  selectedElementId: string | null;
  onElementsChange: (elements: UIElement[]) => void;
  onSelectElement: (id: string | null) => void;
  onElementCreated?: (element: UIElement) => void;  // Callback for auto-generating tasks
  currentType: ElementType;
  drawMode: "single" | "grid";
  gridRows: number;
  gridCols: number;
  isColorSampling?: boolean;
  onColorSampled?: (color: string) => void;
  zoomLevel?: number;
  isCropMode?: boolean;
  cropRect?: BBox | null;
  onCropRectChange?: (rect: BBox | null) => void;
  isIconPlacementMode?: boolean;
  onIconPlaced?: (elementId: string, icon: IconDefinition) => void;
}

export default function AnnotationCanvas({
  imageUrl,
  imageSize,
  elements,
  selectedElementId,
  onElementsChange,
  onSelectElement,
  onElementCreated,
  currentType,
  drawMode,
  gridRows,
  gridCols,
  isColorSampling,
  onColorSampled,
  zoomLevel = 1,
  isCropMode,
  cropRect,
  onCropRectChange,
  isIconPlacementMode,
  onIconPlaced,
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
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [draggingDivider, setDraggingDivider] = useState<{
    elementId: string;
    type: "row" | "col";
    index: number;
    startPos: number;
  } | null>(null);
  const [hoverDivider, setHoverDivider] = useState<{
    elementId: string;
    type: "row" | "col";
    index: number;
  } | null>(null);
  const [cropResizeEdge, setCropResizeEdge] = useState<string | null>(null);
  const [cropResizeStart, setCropResizeStart] = useState<{ x: number; y: number; bbox: BBox } | null>(null);
  const [hoverCropEdge, setHoverCropEdge] = useState<string | null>(null);

  // Cache for loading indicator images
  const loadingImages = useRef<Map<string, HTMLImageElement>>(new Map());

  // Edge detection threshold in pixels
  const EDGE_THRESHOLD = 8;
  const DIVIDER_THRESHOLD = 6;

  // Effective scale with zoom (defined early for use in callbacks)
  const scale = baseScale * zoomLevel;

  // Detect if mouse is near a grid divider
  const detectDivider = useCallback(
    (pos: { x: number; y: number }): { elementId: string; type: "row" | "col"; index: number } | null => {
      const threshold = DIVIDER_THRESHOLD / scale;

      for (const el of elements) {
        const rows = el.rows || 1;
        const cols = el.cols || 1;
        if (rows <= 1 && cols <= 1) continue;

        const { x, y, width, height } = el.bbox;
        // Check if point is within element bounds
        if (pos.x < x - threshold || pos.x > x + width + threshold) continue;
        if (pos.y < y - threshold || pos.y > y + height + threshold) continue;

        const { colPositions, rowPositions } = getGridPositions(el);

        // Check column dividers (vertical lines)
        for (let c = 0; c < colPositions.length; c++) {
          if (Math.abs(pos.x - colPositions[c]) < threshold && pos.y >= y && pos.y <= y + height) {
            return { elementId: el.id, type: "col", index: c };
          }
        }

        // Check row dividers (horizontal lines)
        for (let r = 0; r < rowPositions.length; r++) {
          if (Math.abs(pos.y - rowPositions[r]) < threshold && pos.x >= x && pos.x <= x + width) {
            return { elementId: el.id, type: "row", index: r };
          }
        }
      }

      return null;
    },
    [elements, scale]
  );

  // Handle Space key for pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore space when focus is on text inputs or textareas
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Calculate base scale to fit image in container
  const recalculateScale = useCallback(() => {
    if (!imageSize || !containerRef.current) return;
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const scaleX = containerWidth / imageSize[0];
    const scaleY = containerHeight / imageSize[1];
    const newBaseScale = Math.min(scaleX, scaleY, 1); // Don't scale up
    setBaseScale(newBaseScale);
  }, [imageSize]);

  useEffect(() => {
    recalculateScale();
    setPan({ x: 0, y: 0 }); // Reset pan when image changes
  }, [imageSize, recalculateScale]);

  // Recalculate scale when container resizes (e.g., panels collapse)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      recalculateScale();
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [recalculateScale]);

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

  // Preload loading indicator images
  useEffect(() => {
    const loadingElements = elements.filter(el => el.type === "loading" && el.loadingImage);
    loadingElements.forEach(el => {
      if (!loadingImages.current.has(el.id) || loadingImages.current.get(el.id)?.src !== el.loadingImage) {
        const img = new Image();
        img.src = el.loadingImage!;
        loadingImages.current.set(el.id, img);
      }
    });
    // Clean up removed elements
    loadingImages.current.forEach((_, id) => {
      if (!loadingElements.find(el => el.id === id)) {
        loadingImages.current.delete(id);
      }
    });
  }, [elements]);

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
          const { colPositions, rowPositions, colBounds, rowBounds } = getGridPositions(el);

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);

          // Draw horizontal division lines
          for (let r = 0; r < rowPositions.length; r++) {
            const lineY = offset.y + rowPositions[r] * scale;
            const isHovered = hoverDivider?.elementId === el.id && hoverDivider?.type === "row" && hoverDivider?.index === r;
            ctx.strokeStyle = isHovered ? "#ffffff" : color;
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.beginPath();
            ctx.moveTo(x, lineY);
            ctx.lineTo(x + w, lineY);
            ctx.stroke();
          }

          // Draw vertical division lines
          for (let c = 0; c < colPositions.length; c++) {
            const lineX = offset.x + colPositions[c] * scale;
            const isHovered = hoverDivider?.elementId === el.id && hoverDivider?.type === "col" && hoverDivider?.index === c;
            ctx.strokeStyle = isHovered ? "#ffffff" : color;
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.beginPath();
            ctx.moveTo(lineX, y);
            ctx.lineTo(lineX, y + h);
            ctx.stroke();
          }

          // Draw cell numbers with background for visibility
          ctx.font = "bold 11px sans-serif";
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const cellX = offset.x + colBounds[c] * scale;
              const cellY = offset.y + rowBounds[r] * scale;
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

        // Draw icons for iconlist elements
        if ((el.type === "iconlist" || el.type === "toolbar" || el.type === "menubar") && el.icons && el.icons.length > 0) {
          const iconW = el.iconWidth ?? 32;
          const iconH = el.iconHeight ?? 32;

          ctx.setLineDash([]);
          el.icons.forEach((icon, idx) => {
            // Calculate absolute icon center position
            const iconCenterX = offset.x + (el.bbox.x + icon.centerX) * scale;
            const iconCenterY = offset.y + (el.bbox.y + icon.centerY) * scale;
            const scaledW = iconW * scale;
            const scaledH = iconH * scale;

            // Draw icon bounding box
            ctx.strokeStyle = "#f97316"; // Orange
            ctx.lineWidth = 2;
            ctx.strokeRect(
              iconCenterX - scaledW / 2,
              iconCenterY - scaledH / 2,
              scaledW,
              scaledH
            );

            // Draw center crosshair
            ctx.beginPath();
            ctx.moveTo(iconCenterX - 5, iconCenterY);
            ctx.lineTo(iconCenterX + 5, iconCenterY);
            ctx.moveTo(iconCenterX, iconCenterY - 5);
            ctx.lineTo(iconCenterX, iconCenterY + 5);
            ctx.stroke();

            // Draw index number
            ctx.font = "bold 10px sans-serif";
            const numText = String(idx + 1);
            const numWidth = ctx.measureText(numText).width;
            ctx.fillStyle = "#f97316";
            ctx.fillRect(iconCenterX - scaledW / 2 - 1, iconCenterY - scaledH / 2 - 14, numWidth + 6, 12);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(numText, iconCenterX - scaledW / 2 + 2, iconCenterY - scaledH / 2 - 4);

            // Draw label if exists
            if (icon.label) {
              ctx.font = "10px sans-serif";
              const labelWidth = ctx.measureText(icon.label).width;
              ctx.fillStyle = "rgba(0,0,0,0.7)";
              ctx.fillRect(iconCenterX - labelWidth / 2 - 2, iconCenterY + scaledH / 2 + 2, labelWidth + 4, 12);
              ctx.fillStyle = "#ffffff";
              ctx.fillText(icon.label, iconCenterX - labelWidth / 2, iconCenterY + scaledH / 2 + 12);
            }
          });
        }

        // Draw loading indicator image
        if (el.type === "loading" && el.loadingImage) {
          const img = loadingImages.current.get(el.id);
          if (img && img.complete) {
            ctx.drawImage(img, x, y, w, h);
          }
          // Draw wait time label
          const waitLabel = `wait: ${el.waitTime ?? 3}s`;
          ctx.font = "bold 11px sans-serif";
          const waitWidth = ctx.measureText(waitLabel).width;
          ctx.fillStyle = "#f472b6";
          ctx.fillRect(x + w - waitWidth - 8, y + h - 16, waitWidth + 6, 14);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(waitLabel, x + w - waitWidth - 5, y + h - 5);
        }
      });
      } // end if !isColorSampling

      // Draw current rectangle being drawn (also hide when sampling)
      if (currentRect && !isColorSampling && !isCropMode) {
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

      // Draw crop rectangle
      if (cropRect && isCropMode) {
        const x = offset.x + cropRect.x * scale;
        const y = offset.y + cropRect.y * scale;
        const w = cropRect.width * scale;
        const h = cropRect.height * scale;

        // Draw darkened overlay outside crop area
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        // Top
        ctx.fillRect(offset.x, offset.y, imageSize[0] * scale, cropRect.y * scale);
        // Bottom
        ctx.fillRect(offset.x, y + h, imageSize[0] * scale, (imageSize[1] - cropRect.y - cropRect.height) * scale);
        // Left
        ctx.fillRect(offset.x, y, cropRect.x * scale, h);
        // Right
        ctx.fillRect(x + w, y, (imageSize[0] - cropRect.x - cropRect.width) * scale, h);

        // Draw crop border
        ctx.strokeStyle = "#f97316"; // Orange
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, w, h);

        // Draw corner handles
        const handleSize = 8;
        ctx.fillStyle = "#f97316";
        // Corners
        ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + w - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x - handleSize/2, y + h - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + w - handleSize/2, y + h - handleSize/2, handleSize, handleSize);
        // Edge midpoints
        ctx.fillRect(x + w/2 - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + w/2 - handleSize/2, y + h - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x - handleSize/2, y + h/2 - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + w - handleSize/2, y + h/2 - handleSize/2, handleSize, handleSize);

        // Draw dimensions label
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#f97316";
        const dimText = `${Math.round(cropRect.width)} × ${Math.round(cropRect.height)}`;
        const textMetrics = ctx.measureText(dimText);
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(x + w/2 - textMetrics.width/2 - 4, y + h + 8, textMetrics.width + 8, 18);
        ctx.fillStyle = "#f97316";
        ctx.fillText(dimText, x + w/2 - textMetrics.width/2, y + h + 22);
      }
    };
    img.src = imageUrl;
  }, [imageUrl, imageSize, elements, selectedElementId, currentRect, scale, offset, currentType, drawMode, gridRows, gridCols, isColorSampling, hoverDivider, cropRect, isCropMode]);

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

  // Detect which edge of crop rect mouse is near
  const detectCropEdge = useCallback(
    (pos: { x: number; y: number }): string | null => {
      if (!cropRect) return null;

      const threshold = EDGE_THRESHOLD / scale;
      const { x, y, width, height } = cropRect;
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
    [cropRect, scale]
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

    // Middle mouse button, Alt key, or Space key held = start panning
    if (e.button === 1 || e.altKey || spaceHeld) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const pos = screenToImage(e.clientX, e.clientY);

    // Check for grid divider drag
    const divider = detectDivider(pos);
    if (divider) {
      setDraggingDivider({
        ...divider,
        startPos: divider.type === "col" ? pos.x : pos.y,
      });
      return;
    }

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

    // Handle crop mode
    if (isCropMode) {
      // Check for crop rect edge resize
      const cropEdge = detectCropEdge(pos);
      if (cropEdge && cropRect) {
        setCropResizeEdge(cropEdge);
        setCropResizeStart({ x: pos.x, y: pos.y, bbox: cropRect });
        return;
      }
      // Start drawing new crop rect
      setIsDrawing(true);
      setStartPoint(pos);
      return;
    }

    // Handle icon placement mode for IconList elements
    if (isIconPlacementMode && selectedElementId && onIconPlaced) {
      const selectedEl = elements.find((el) => el.id === selectedElementId);
      if (selectedEl && (selectedEl.type === "iconlist" || selectedEl.type === "toolbar" || selectedEl.type === "menubar")) {
        // Check if click is within the iconlist bounds
        if (
          pos.x >= selectedEl.bbox.x &&
          pos.x <= selectedEl.bbox.x + selectedEl.bbox.width &&
          pos.y >= selectedEl.bbox.y &&
          pos.y <= selectedEl.bbox.y + selectedEl.bbox.height
        ) {
          // Calculate relative position within iconlist
          const relX = pos.x - selectedEl.bbox.x;
          const relY = pos.y - selectedEl.bbox.y;
          const elementId = `icon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          onIconPlaced(selectedEl.id, { elementId, centerX: relX, centerY: relY });
        }
        // In icon placement mode, don't start drawing regardless of where clicked
        return;
      }
    }

    // Always start drawing - we'll check on mouseUp if it was a click or drag
    setIsDrawing(true);
    setStartPoint(pos);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!imageUrl) return;

    // Skip element selection when in icon placement mode
    if (isIconPlacementMode) return;

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

    if (clickedElement !== null) {
      onSelectElement((clickedElement as UIElement).id);
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

    // Handle divider dragging
    if (draggingDivider) {
      const el = elements.find((el) => el.id === draggingDivider.elementId);
      if (!el) return;

      const rows = el.rows || 1;
      const cols = el.cols || 1;
      const { x, y, width, height } = el.bbox;

      if (draggingDivider.type === "col") {
        // Dragging a vertical divider (column boundary)
        const currentWidths = el.colWidths && el.colWidths.length === cols
          ? [...el.colWidths]
          : Array(cols).fill(1 / cols);

        // Calculate new position as fraction
        const newPosX = Math.max(x + 10, Math.min(pos.x, x + width - 10));
        const newFraction = (newPosX - x) / width;

        // Get cumulative widths up to this divider
        let cumBefore = 0;
        for (let i = 0; i < draggingDivider.index; i++) {
          cumBefore += currentWidths[i];
        }

        // The divider is between index and index+1
        // Adjust so divider position = cumBefore + currentWidths[index]
        const minWidth = 10 / width; // minimum 10px
        const leftCol = draggingDivider.index;
        const rightCol = draggingDivider.index + 1;

        // Calculate what the left column width should be
        const newLeftWidth = Math.max(minWidth, newFraction - cumBefore);
        // Right column takes the difference
        const oldCombined = currentWidths[leftCol] + currentWidths[rightCol];
        const newRightWidth = Math.max(minWidth, oldCombined - newLeftWidth);

        currentWidths[leftCol] = newLeftWidth;
        currentWidths[rightCol] = newRightWidth;

        // Normalize to ensure sum = 1
        const sum = currentWidths.reduce((a, b) => a + b, 0);
        const normalizedWidths = currentWidths.map(w => w / sum);

        onElementsChange(
          elements.map((el) =>
            el.id === draggingDivider.elementId ? { ...el, colWidths: normalizedWidths } : el
          )
        );
      } else {
        // Dragging a horizontal divider (row boundary)
        const currentHeights = el.rowHeights && el.rowHeights.length === rows
          ? [...el.rowHeights]
          : Array(rows).fill(1 / rows);

        // Calculate new position as fraction
        const newPosY = Math.max(y + 10, Math.min(pos.y, y + height - 10));
        const newFraction = (newPosY - y) / height;

        // Get cumulative heights up to this divider
        let cumBefore = 0;
        for (let i = 0; i < draggingDivider.index; i++) {
          cumBefore += currentHeights[i];
        }

        const minHeight = 10 / height;
        const topRow = draggingDivider.index;
        const bottomRow = draggingDivider.index + 1;

        const newTopHeight = Math.max(minHeight, newFraction - cumBefore);
        const oldCombined = currentHeights[topRow] + currentHeights[bottomRow];
        const newBottomHeight = Math.max(minHeight, oldCombined - newTopHeight);

        currentHeights[topRow] = newTopHeight;
        currentHeights[bottomRow] = newBottomHeight;

        // Normalize
        const sum = currentHeights.reduce((a, b) => a + b, 0);
        const normalizedHeights = currentHeights.map(h => h / sum);

        onElementsChange(
          elements.map((el) =>
            el.id === draggingDivider.elementId ? { ...el, rowHeights: normalizedHeights } : el
          )
        );
      }
      return;
    }

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

    // Handle crop rect resizing
    if (cropResizeEdge && cropResizeStart && onCropRectChange && imageSize) {
      const dx = pos.x - cropResizeStart.x;
      const dy = pos.y - cropResizeStart.y;
      const orig = cropResizeStart.bbox;
      let newBbox = { ...orig };

      const [imgW, imgH] = imageSize;

      switch (cropResizeEdge) {
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

      onCropRectChange(newBbox);
      return;
    }

    // Update hover edge/divider for cursor
    if (!isDrawing && !isColorSampling && !isCropMode) {
      // Check for divider hover first
      const divider = detectDivider(pos);
      setHoverDivider(divider);

      // Then check for edge hover (only if not hovering a divider)
      if (!divider) {
        const edge = detectEdge(pos);
        setHoverEdge(edge);
      } else {
        setHoverEdge(null);
      }
    }

    // Update hover for crop mode
    if (isCropMode && !isDrawing && !cropResizeEdge) {
      const cropEdge = detectCropEdge(pos);
      setHoverCropEdge(cropEdge);
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

    // In crop mode, update crop rect instead of currentRect
    if (isCropMode && onCropRectChange) {
      onCropRectChange({ x, y, width, height });
    } else {
      setCurrentRect({ x, y, width, height });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Stop panning
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Stop divider dragging
    if (draggingDivider) {
      setDraggingDivider(null);
      return;
    }

    // Stop resizing
    if (resizeEdge) {
      setResizeEdge(null);
      setResizeStart(null);
      return;
    }

    // Stop crop resizing
    if (cropResizeEdge) {
      setCropResizeEdge(null);
      setCropResizeStart(null);
      return;
    }

    if (!isDrawing) {
      return;
    }

    // Crop mode: just stop drawing (crop rect is already updated via onCropRectChange)
    if (isCropMode) {
      setIsDrawing(false);
      setStartPoint(null);
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
      // For listbox, create container + child cells (dropdown options are generated)
      const needsChildCells = currentType === "listbox";

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
        onElementCreated?.(newElement);
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
      onElementCreated?.(newElement);
    }

    setIsDrawing(false);
    setCurrentRect(null);
    setStartPoint(null);
  };

  // Determine cursor style
  const getCursor = (): string => {
    if (isPanning) return "grabbing";
    if (spaceHeld) return "grab";
    if (draggingDivider) {
      return draggingDivider.type === "col" ? "col-resize" : "row-resize";
    }
    if (hoverDivider) {
      return hoverDivider.type === "col" ? "col-resize" : "row-resize";
    }
    if (cropResizeEdge) return getCursorForEdge(cropResizeEdge);
    if (hoverCropEdge) return getCursorForEdge(hoverCropEdge);
    if (resizeEdge) return getCursorForEdge(resizeEdge);
    if (isColorSampling) return "copy";
    if (isCropMode) return "crosshair";
    if (isIconPlacementMode) return "cell";
    if (hoverEdge) return getCursorForEdge(hoverEdge);
    return "crosshair";
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0`}
        style={{ cursor: getCursor() }}
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
          setDraggingDivider(null);
          setHoverDivider(null);
          setCropResizeEdge(null);
          setCropResizeStart(null);
          setHoverCropEdge(null);
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
