/**
 * DataTypesModal Component
 *
 * Modal for extracting structured data types from images via OCR.
 * Column headers become attribute names, rows become example instances.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { transcribeRegion } from "@/services/chandraService";
import type { PendingExtraction } from "@/types/dataTypes";

// Re-export useDataTypes for consumers
export { useDataTypes } from "@/hooks";

interface DataTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataTypes: ReturnType<typeof import("@/hooks").useDataTypes>;
}

export default function DataTypesModal({ isOpen, onClose, dataTypes }: DataTypesModalProps) {
  const [newTypeName, setNewTypeName] = useState("");
  const [isAddingType, setIsAddingType] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Crop drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);

  // Load image when current image changes
  useEffect(() => {
    if (!dataTypes.currentImage) {
      imageRef.current = null;
      return;
    }

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = dataTypes.currentImage.dataUrl;
  }, [dataTypes.currentImage]);

  // Draw canvas with image and crop rect
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const cropRect = dataTypes.currentImage?.cropRect;
    if (cropRect) {
      const { x, y, width, height } = cropRect;
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y + height, canvas.width, canvas.height - y - height);
      ctx.fillRect(0, y, x, height);
      ctx.fillRect(x + width, y, canvas.width - x - width, height);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    }
  }, [dataTypes.currentImage?.cropRect]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas, dataTypes.currentImage?.cropRect]);

  // Handle file upload (multiple)
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const promises: Promise<string>[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        promises.push(
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          })
        );
      }

      Promise.all(promises).then((dataUrls) => {
        dataTypes.addImages(dataUrls);
      });

      e.target.value = "";
    },
    [dataTypes]
  );

  // Handle paste
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              dataTypes.addImages([reader.result as string]);
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, dataTypes]);

  // Mouse handlers for crop drawing
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setIsDrawing(true);
    setDrawStart(pos);
    dataTypes.setCropRect(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart) return;
    const pos = getMousePos(e);
    const x = Math.min(drawStart.x, pos.x);
    const y = Math.min(drawStart.y, pos.y);
    const width = Math.abs(pos.x - drawStart.x);
    const height = Math.abs(pos.y - drawStart.y);
    if (width > 5 && height > 5) {
      dataTypes.setCropRect({ x, y, width, height });
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setDrawStart(null);
  };

  // Cancel ongoing OCR extraction
  const handleCancelExtract = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dataTypes.setIsExtracting(false);
  }, [dataTypes]);

  // Extract OCR from image
  const handleExtract = useCallback(async () => {
    if (!dataTypes.currentImage || !dataTypes.selectedTypeId) return;

    const img = imageRef.current;
    if (!img) return;

    abortControllerRef.current = new AbortController();
    dataTypes.setIsExtracting(true);

    try {
      const tempCanvas = document.createElement("canvas");
      const cropRect = dataTypes.currentImage.cropRect;

      if (cropRect) {
        const { x, y, width, height } = cropRect;
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      } else {
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
      }

      const imageBase64 = tempCanvas.toDataURL("image/png").split(",")[1];

      const result = await transcribeRegion(
        {
          elementId: "extract",
          elementType: "text",
          imageBase64,
          bbox: { x: 0, y: 0, width: tempCanvas.width, height: tempCanvas.height },
        },
        abortControllerRef.current.signal
      );

      const rawText = result.text || "";
      dataTypes.setLastOcrText(rawText);

      if (!rawText.trim()) {
        alert("OCR returned empty text. Try a different image or crop region.");
        return;
      }

      // Parse into table structure
      const parsed = parseOcrToTable(rawText);
      if (parsed) {
        dataTypes.setPendingExtraction({
          headers: parsed.headers,
          rows: parsed.rows,
          imageDataUrl: tempCanvas.toDataURL("image/png"),
          rawOcrText: rawText,
        });
      } else {
        alert("Could not parse table structure. Need at least a header row + 1 data row. Check Raw OCR output below.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("OCR extraction cancelled");
      } else {
        console.error("OCR extraction failed:", err);
        alert("OCR extraction failed. Check console for details.");
      }
    } finally {
      abortControllerRef.current = null;
      dataTypes.setIsExtracting(false);
    }
  }, [dataTypes]);

  // Add new type
  const handleAddType = () => {
    if (!newTypeName.trim()) return;
    dataTypes.addType(newTypeName);
    setNewTypeName("");
    setIsAddingType(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-zinc-900 rounded-lg w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-semibold">Data Types</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Type list */}
          <div className="w-48 bg-zinc-800 border-r border-zinc-700 flex flex-col">
            <div className="p-2 border-b border-zinc-700">
              {isAddingType ? (
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddType();
                    if (e.key === "Escape") {
                      setIsAddingType(false);
                      setNewTypeName("");
                    }
                  }}
                  onBlur={() => {
                    if (!newTypeName.trim()) setIsAddingType(false);
                  }}
                  placeholder="Type name (Enter)..."
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setIsAddingType(true)}
                  className="w-full bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded text-sm"
                >
                  + New Type
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {dataTypes.types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => dataTypes.selectType(t.id)}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-zinc-700 ${
                    dataTypes.selectedTypeId === t.id ? "bg-blue-600" : "hover:bg-zinc-700"
                  }`}
                >
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-xs text-zinc-400">
                    {t.attributes.length} attrs, {t.examples.length} examples
                  </div>
                </button>
              ))}
            </div>

            {dataTypes.selectedTypeId && (
              <div className="p-2 border-t border-zinc-700">
                <button
                  onClick={() => dataTypes.deleteType(dataTypes.selectedTypeId!)}
                  className="w-full bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm"
                >
                  Delete Type
                </button>
              </div>
            )}
          </div>

          {/* Right panel - Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {dataTypes.selectedType ? (
              <>
                {/* Type name header */}
                <div className="px-4 py-2 border-b border-zinc-700 bg-zinc-800">
                  <h3 className="text-lg font-medium">{dataTypes.selectedType.name}</h3>
                  {dataTypes.selectedType.attributes.length > 0 && (
                    <div className="text-xs text-zinc-400 mt-1">
                      Attributes: {dataTypes.selectedType.attributes.join(", ")}
                    </div>
                  )}
                </div>

                <div className="flex-1 flex overflow-hidden">
                  {/* Image/Crop area */}
                  <div className="flex-1 flex flex-col border-r border-zinc-700">
                    <div className="p-2 border-b border-zinc-700 flex gap-2 items-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded text-sm"
                      >
                        Upload Images
                      </button>
                      <span className="text-zinc-500 text-sm">or Ctrl+V</span>
                      {dataTypes.images.length > 0 && (
                        <>
                          <div className="flex-1" />
                          <button
                            onClick={() => dataTypes.setCurrentImageIndex(dataTypes.currentImageIndex - 1)}
                            disabled={dataTypes.currentImageIndex === 0}
                            className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 px-2 py-1 rounded text-sm"
                          >
                            ←
                          </button>
                          <span className="text-sm text-zinc-400">
                            {dataTypes.currentImageIndex + 1} / {dataTypes.images.length}
                          </span>
                          <button
                            onClick={() => dataTypes.setCurrentImageIndex(dataTypes.currentImageIndex + 1)}
                            disabled={dataTypes.currentImageIndex >= dataTypes.images.length - 1}
                            className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 px-2 py-1 rounded text-sm"
                          >
                            →
                          </button>
                          <button
                            onClick={() => dataTypes.removeImage(dataTypes.currentImageIndex)}
                            className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-sm"
                            title="Remove current image"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex-1 overflow-auto p-2 bg-zinc-950">
                      {dataTypes.currentImage ? (
                        <canvas
                          ref={canvasRef}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          className="max-w-full cursor-crosshair"
                          style={{ maxHeight: "100%" }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-zinc-500">
                          Upload or paste images to begin
                        </div>
                      )}
                    </div>

                    <div className="p-2 border-t border-zinc-700 flex gap-2">
                      {dataTypes.isExtracting ? (
                        <button
                          onClick={handleCancelExtract}
                          className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-sm font-medium"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={handleExtract}
                          disabled={!dataTypes.currentImage}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed px-4 py-1.5 rounded text-sm font-medium"
                        >
                          Extract OCR
                        </button>
                      )}
                      {dataTypes.currentImage?.cropRect && (
                        <button
                          onClick={() => dataTypes.setCropRect(null)}
                          className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded text-sm"
                        >
                          Clear Crop
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Data panel */}
                  <div className="w-96 flex flex-col">
                    {/* Pending extraction preview */}
                    {dataTypes.pendingExtraction ? (
                      <div className="flex-1 flex flex-col">
                        <div className="p-2 border-b border-zinc-700 bg-yellow-900/30">
                          <div className="text-sm font-medium text-yellow-400">
                            Preview: {dataTypes.pendingExtraction.rows.length} rows extracted
                          </div>
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-zinc-700">
                                {dataTypes.pendingExtraction.headers.map((h, i) => (
                                  <th key={i} className="text-left p-1 text-zinc-400 font-medium">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {dataTypes.pendingExtraction.rows.map((row, i) => (
                                <tr key={i} className="border-b border-zinc-800">
                                  {dataTypes.pendingExtraction!.headers.map((h, j) => (
                                    <td key={j} className="p-1 truncate max-w-[100px]" title={row[h]}>
                                      {row[h] || ""}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="p-2 border-t border-zinc-700 flex gap-2">
                          <button
                            onClick={() => dataTypes.confirmExtraction()}
                            className="bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded text-sm font-medium"
                          >
                            Add to Type
                          </button>
                          <button
                            onClick={() => dataTypes.cancelExtraction()}
                            className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded text-sm"
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-2 border-b border-zinc-700 flex justify-between items-center">
                          <span className="text-sm font-medium">
                            Examples ({dataTypes.selectedType.examples.length})
                          </span>
                          <button
                            onClick={() => dataTypes.clearExamples()}
                            disabled={dataTypes.selectedType.examples.length === 0}
                            className="text-xs text-red-400 hover:text-red-300 disabled:text-zinc-600"
                          >
                            Clear All
                          </button>
                        </div>

                        <div className="flex-1 overflow-auto p-2">
                          {dataTypes.selectedType.examples.length === 0 ? (
                            <div className="text-zinc-500 text-sm text-center py-4">
                              No examples extracted yet.<br />
                              Upload an image and extract to add examples.
                            </div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-zinc-700">
                                  {dataTypes.selectedType.attributes.map((attr, i) => (
                                    <th key={i} className="text-left p-1 text-zinc-400 font-medium">
                                      {attr}
                                    </th>
                                  ))}
                                  <th className="w-6"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {dataTypes.selectedType.examples.map((ex, i) => (
                                  <tr key={i} className="border-b border-zinc-800 group">
                                    {dataTypes.selectedType!.attributes.map((attr, j) => (
                                      <td key={j} className="p-1 truncate max-w-[80px]" title={ex[attr]}>
                                        {ex[attr] || ""}
                                      </td>
                                    ))}
                                    <td className="p-1">
                                      <button
                                        onClick={() => dataTypes.removeExample(i)}
                                        className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                                      >
                                        ×
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {/* Raw OCR output */}
                        {dataTypes.lastOcrText && (
                          <div className="border-t border-zinc-700">
                            <div className="p-2 text-sm font-medium text-zinc-400">Raw OCR:</div>
                            <div className="max-h-32 overflow-y-auto p-2 bg-zinc-950 text-xs font-mono whitespace-pre-wrap">
                              {dataTypes.lastOcrText}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500">
                Select or create a data type to begin
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-700">
          <div className="text-xs text-zinc-500">
            Data types will be included when you export the annotation
          </div>
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Parse OCR text into table structure (headers + rows).
 * First row = headers (attribute names), subsequent rows = data.
 */
function parseOcrToTable(text: string): { headers: string[]; rows: Record<string, string>[] } | null {
  const allRows: string[][] = [];

  // Check if it's HTML table
  if (/<table|<tr|<td|<th/i.test(text)) {
    // Parse HTML table rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(text)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const cellText = cellMatch[1]
          .replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ")
          .trim();
        cells.push(cellText);
      }
      if (cells.length > 0) {
        allRows.push(cells);
      }
    }
  } else {
    // Parse markdown/plain text table
    const lines = text.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      // Skip separator lines
      if (/^\|?[\s-:|]+\|?$/.test(line)) continue;

      let cells: string[] = [];
      if (line.includes("|")) {
        cells = line
          .split("|")
          .map((p) => p.trim())
          .filter((p) => p !== "" && !/^-+$/.test(p));
      } else if (line.includes("\t")) {
        cells = line.split("\t").map((p) => p.trim());
      } else {
        // Single line - treat as single cell
        cells = [line.trim()];
      }

      if (cells.length > 0) {
        allRows.push(cells);
      }
    }
  }

  if (allRows.length < 2) {
    return null; // Need at least headers + 1 data row
  }

  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  // Convert to objects
  const rows: Record<string, string>[] = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });

  return { headers, rows };
}
