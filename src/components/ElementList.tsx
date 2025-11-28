"use client";

import { useState, useCallback } from "react";
import { UIElement, ElementType, ELEMENT_TYPES, getElementColor, HAlign, VAlign } from "@/types/annotation";

interface Props {
  elements: UIElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<UIElement>) => void;
  onDeleteElement: (id: string) => void;
  onCropToElement: (id: string) => void;
  onStartColorSampling: () => void;
}

export default function ElementList({
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onCropToElement,
  onStartColorSampling,
}: Props) {
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const selectedElement = elements.find((el) => el.id === selectedElementId);

  const isListType = selectedElement?.type === "dropdown" || selectedElement?.type === "listbox";
  const isGridType = selectedElement?.type === "grid" || selectedElement?.type === "icon";
  const isIcon = selectedElement?.type === "icon";
  const isPanel = selectedElement?.type === "panel" || selectedElement?.type === "toolbar" || selectedElement?.type === "menubar";
  const isText = selectedElement?.type === "text";
  const isMaskable = selectedElement && ["textinput", "dropdown", "listbox", "grid", "icon", "panel", "toolbar", "menubar", "text"].includes(selectedElement.type);

  // Get panel elements for parent selection
  const panelElements = elements.filter((el) => el.type === "panel" || el.type === "toolbar" || el.type === "menubar");

  // Check if panel has child icons
  const hasChildIcons = isPanel && elements.some((el) => el.type === "icon" && el.parentId === selectedElement?.id);

  const handleItemClick = useCallback((e: React.MouseEvent, clickedId: string) => {
    if (e.shiftKey && selectedElementId) {
      // Shift+click: select range
      const startIdx = elements.findIndex((el) => el.id === selectedElementId);
      const endIdx = elements.findIndex((el) => el.id === clickedId);
      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const rangeIds = elements.slice(minIdx, maxIdx + 1).map((el) => el.id);
        setMultiSelected(new Set(rangeIds));
      }
    } else {
      // Normal click: single select, clear multi-select
      setMultiSelected(new Set());
      onSelectElement(clickedId);
    }
  }, [elements, selectedElementId, onSelectElement]);

  const handleDeleteSelected = useCallback(() => {
    multiSelected.forEach((id) => onDeleteElement(id));
    setMultiSelected(new Set());
  }, [multiSelected, onDeleteElement]);

  // Check if element contains other elements (can be used as crop region)
  const containsOtherElements = selectedElement && elements.some(
    (el) =>
      el.id !== selectedElement.id &&
      el.bbox.x >= selectedElement.bbox.x &&
      el.bbox.y >= selectedElement.bbox.y &&
      el.bbox.x + el.bbox.width <= selectedElement.bbox.x + selectedElement.bbox.width &&
      el.bbox.y + el.bbox.height <= selectedElement.bbox.y + selectedElement.bbox.height
  );

  return (
    <div className="flex flex-col h-full">
      {/* Element list - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {multiSelected.size > 0 && (
            <div className="flex items-center justify-between mb-2 p-2 bg-zinc-700 rounded">
              <span className="text-xs text-zinc-300">{multiSelected.size} selected</span>
              <button
                onClick={handleDeleteSelected}
                className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1"
              >
                Delete Selected
              </button>
            </div>
          )}
          {elements.length === 0 ? (
            <p className="text-xs text-zinc-500 px-1">
              Draw on the image to add elements
            </p>
          ) : (
            <ul className="space-y-0.5">
              {elements.map((el) => {
                const isMultiSelected = multiSelected.has(el.id);
                const isSingleSelected = el.id === selectedElementId && multiSelected.size === 0;
                return (
                  <li
                    key={el.id}
                    onClick={(e) => handleItemClick(e, el.id)}
                    className={`
                      flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm
                      ${isMultiSelected ? "bg-blue-600/50 ring-1 ring-blue-500" : ""}
                      ${isSingleSelected ? "bg-zinc-700" : ""}
                      ${!isMultiSelected && !isSingleSelected ? "hover:bg-zinc-800" : ""}
                    `}
                  >
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: getElementColor(el.type) }}
                    />
                    <span className="flex-1 truncate">
                      {el.text || el.type}
                    </span>
                    {(el.rows && el.rows > 1) || (el.cols && el.cols > 1) ? (
                      <span className="text-xs text-zinc-500">
                        {el.rows || 1}×{el.cols || 1}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">
                        {el.bbox.width}×{el.bbox.height}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Selected element editor - fixed at bottom (hidden when multi-selecting) */}
      {selectedElement && multiSelected.size === 0 && (
        <div className="p-3 border-t border-zinc-700 bg-zinc-800 max-h-[50%] overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2">Edit Element</h3>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-zinc-400">Type</label>
              <select
                value={selectedElement.type}
                onChange={(e) =>
                  onUpdateElement(selectedElement.id, {
                    type: e.target.value as ElementType,
                  })
                }
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
              >
                {ELEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400">Label / Text</label>
              <input
                type="text"
                value={selectedElement.text ?? ""}
                onChange={(e) => {
                  // Auto-hyphenate: replace spaces with hyphens
                  const hyphenated = e.target.value.replace(/\s+/g, "-").toLowerCase();
                  onUpdateElement(selectedElement.id, { text: hyphenated });
                }}
                placeholder="e.g., ok, cancel, username..."
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
              />
            </div>

            <div className="grid grid-cols-4 gap-1 text-xs">
              <div>
                <label className="text-zinc-400">X</label>
                <input
                  type="number"
                  value={selectedElement.bbox.x}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      bbox: { ...selectedElement.bbox, x: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5"
                />
              </div>
              <div>
                <label className="text-zinc-400">Y</label>
                <input
                  type="number"
                  value={selectedElement.bbox.y}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      bbox: { ...selectedElement.bbox, y: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5"
                />
              </div>
              <div>
                <label className="text-zinc-400">W</label>
                <input
                  type="number"
                  value={selectedElement.bbox.width}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      bbox: { ...selectedElement.bbox, width: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5"
                />
              </div>
              <div>
                <label className="text-zinc-400">H</label>
                <input
                  type="number"
                  value={selectedElement.bbox.height}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      bbox: { ...selectedElement.bbox, height: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5"
                />
              </div>
            </div>

            {/* Mask option for data elements */}
            {isMaskable && (
              <div className="mt-2 pt-2 border-t border-zinc-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedElement.mask ?? true}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, { mask: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs text-zinc-400">Mask in export</span>
                </label>
                {(selectedElement.mask ?? true) && (
                  <button
                    onClick={onStartColorSampling}
                    className={`mt-2 text-xs px-2 py-1 rounded flex items-center gap-2 ${
                      selectedElement.maskColor
                        ? "bg-zinc-700 hover:bg-zinc-600"
                        : "bg-yellow-600 hover:bg-yellow-700 text-white"
                    }`}
                    title="Click on image to sample color"
                  >
                    {selectedElement.maskColor ? (
                      <span
                        className="w-4 h-4 rounded border border-zinc-500"
                        style={{ backgroundColor: selectedElement.maskColor }}
                      />
                    ) : (
                      <span className="w-4 h-4 rounded border border-dashed border-white/50 bg-yellow-700" />
                    )}
                    {selectedElement.maskColor ? "Change Color" : "Sample Color (required)"}
                  </button>
                )}
              </div>
            )}

            {/* Parent Panel for icons */}
            {isIcon && panelElements.length > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-600">
                <label className="text-xs text-zinc-400">Parent Panel</label>
                <select
                  value={selectedElement.parentId ?? ""}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      parentId: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                >
                  <option value="">-- No parent --</option>
                  {panelElements.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.text || p.type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Export checkbox for icons and panels */}
            {(isIcon || isPanel) && (
              <div className="mt-2 pt-2 border-t border-zinc-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedElement.exportIcon ?? false}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, { exportIcon: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs text-zinc-400">Export to ZIP</span>
                </label>
              </div>
            )}

            {/* Alignment for text */}
            {isText && (
              <div className="mt-2 pt-2 border-t border-zinc-600">
                <label className="text-xs text-zinc-400 block mb-2">Alignment</label>
                <div className="flex gap-4">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Horizontal</label>
                    <div className="flex gap-1">
                      {(["left", "center", "right"] as HAlign[]).map((align) => (
                        <button
                          key={align}
                          onClick={() => onUpdateElement(selectedElement.id, { hAlign: align })}
                          className={`px-2 py-1 text-xs rounded ${
                            (selectedElement.hAlign || "left") === align
                              ? "bg-blue-600"
                              : "bg-zinc-700 hover:bg-zinc-600"
                          }`}
                        >
                          {align.charAt(0).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Vertical</label>
                    <div className="flex gap-1">
                      {(["top", "center", "bottom"] as VAlign[]).map((align) => (
                        <button
                          key={align}
                          onClick={() => onUpdateElement(selectedElement.id, { vAlign: align })}
                          className={`px-2 py-1 text-xs rounded ${
                            (selectedElement.vAlign || "top") === align
                              ? "bg-blue-600"
                              : "bg-zinc-700 hover:bg-zinc-600"
                          }`}
                        >
                          {align.charAt(0).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Layout for panels */}
            {isPanel && (
              <div className="mt-2 pt-2 border-t border-zinc-600">
                <label className="text-xs text-zinc-400 block mb-2">Icon Layout</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="layout"
                      checked={selectedElement.layout === "sparse" || !selectedElement.layout}
                      onChange={() =>
                        onUpdateElement(selectedElement.id, { layout: "sparse" })
                      }
                      className="w-3 h-3"
                    />
                    <span className="text-xs">Sparse</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="layout"
                      checked={selectedElement.layout === "stacked"}
                      onChange={() =>
                        onUpdateElement(selectedElement.id, { layout: "stacked" })
                      }
                      className="w-3 h-3"
                    />
                    <span className="text-xs">Stacked</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="layout"
                      checked={selectedElement.layout === "random"}
                      onChange={() =>
                        onUpdateElement(selectedElement.id, { layout: "random" })
                      }
                      className="w-3 h-3"
                    />
                    <span className="text-xs">Random</span>
                  </label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={selectedElement.randomOrder ?? false}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, { randomOrder: e.target.checked })
                    }
                    className="w-3 h-3"
                  />
                  <span className="text-xs text-zinc-400">Random order</span>
                </label>
              </div>
            )}

            {/* Rows/Cols for listbox/dropdown/grid */}
            {(isListType || isGridType) && (
              <div className="mt-2 pt-2 border-t border-zinc-600">
                {isListType ? (
                  <div>
                    <label className="text-xs text-zinc-400">Cells (N)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={selectedElement.rows ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          onUpdateElement(selectedElement.id, { rows: undefined, cols: 1 });
                        } else {
                          const num = parseInt(val);
                          if (!isNaN(num) && num >= 1 && num <= 100) {
                            onUpdateElement(selectedElement.id, { rows: num, cols: 1 });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const num = parseInt(e.target.value);
                        if (isNaN(num) || num < 1) {
                          onUpdateElement(selectedElement.id, { rows: 1, cols: 1 });
                        }
                      }}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-zinc-400">Rows</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={selectedElement.rows ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            onUpdateElement(selectedElement.id, { rows: undefined });
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num) && num >= 1 && num <= 50) {
                              onUpdateElement(selectedElement.id, { rows: num });
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const num = parseInt(e.target.value);
                          if (isNaN(num) || num < 1) {
                            onUpdateElement(selectedElement.id, { rows: 1 });
                          }
                        }}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-zinc-400">Cols</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={selectedElement.cols ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            onUpdateElement(selectedElement.id, { cols: undefined });
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num) && num >= 1 && num <= 20) {
                              onUpdateElement(selectedElement.id, { cols: num });
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const num = parseInt(e.target.value);
                          if (isNaN(num) || num < 1) {
                            onUpdateElement(selectedElement.id, { cols: 1 });
                          }
                        }}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onDeleteElement(selectedElement.id)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-sm"
              >
                Delete
              </button>
              {containsOtherElements && (
                <button
                  onClick={() => onCropToElement(selectedElement.id)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded px-2 py-1 text-sm"
                >
                  Crop To
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
