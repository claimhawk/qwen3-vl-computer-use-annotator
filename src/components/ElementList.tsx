"use client";

import { useState, useCallback } from "react";
import { UIElement, ElementType, ELEMENT_TYPES, getElementColor, HAlign, VAlign, IconDefinition } from "@/types/annotation";

interface Props {
  elements: UIElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<UIElement>) => void;
  onDeleteElement: (id: string) => void;
  onStartColorSampling: () => void;
  onUpdateGridTasks?: (element: UIElement) => void;
  isIconPlacementMode?: boolean;
  onToggleIconPlacementMode?: () => void;
}

export default function ElementList({
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onStartColorSampling,
  onUpdateGridTasks,
  isIconPlacementMode,
  onToggleIconPlacementMode,
}: Props) {
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [selectedIconIdx, setSelectedIconIdx] = useState<number | null>(null);
  const selectedElement = elements.find((el) => el.id === selectedElementId);

  const isListType = selectedElement?.type === "dropdown" || selectedElement?.type === "listbox";
  const isGridType = selectedElement?.type === "grid" || selectedElement?.type === "icon";
  const isIcon = selectedElement?.type === "icon";
  const isIconList = selectedElement?.type === "iconlist" || selectedElement?.type === "toolbar" || selectedElement?.type === "menubar";
  const isText = selectedElement?.type === "text";
  const isLoading = selectedElement?.type === "loading";
  const isMaskable = selectedElement && ["textinput", "dropdown", "listbox", "grid", "icon", "iconlist", "toolbar", "menubar", "text", "mask"].includes(selectedElement.type);

  // Get iconlist elements for parent selection
  const iconListElements = elements.filter((el) => el.type === "iconlist" || el.type === "toolbar" || el.type === "menubar");

  // Check if iconlist has icons defined
  const hasIcons = isIconList && (selectedElement?.icons?.length ?? 0) > 0;

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
      setSelectedIconIdx(null); // Clear icon selection when changing elements
      onSelectElement(clickedId);
    }
  }, [elements, selectedElementId, onSelectElement]);

  const handleDeleteSelected = useCallback(() => {
    multiSelected.forEach((id) => onDeleteElement(id));
    setMultiSelected(new Set());
  }, [multiSelected, onDeleteElement]);

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
                const hasIcons = (el.type === "iconlist" || el.type === "toolbar" || el.type === "menubar") && el.icons && el.icons.length > 0;
                return (
                  <li key={el.id}>
                    <div
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
                      {hasIcons ? (
                        <span className="text-xs text-zinc-500">
                          {el.icons!.length} icons
                        </span>
                      ) : (el.rows && el.rows > 1) || (el.cols && el.cols > 1) ? (
                        <span className="text-xs text-zinc-500">
                          {el.rows || 1}×{el.cols || 1}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {el.bbox.width}×{el.bbox.height}
                        </span>
                      )}
                    </div>
                    {/* Show icons as children when this element is selected */}
                    {hasIcons && isSingleSelected && (
                      <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-zinc-600 pl-2">
                        {el.icons!.map((icon, idx) => (
                          <li
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIconIdx(selectedIconIdx === idx ? null : idx);
                            }}
                            className={`px-2 py-1 rounded text-xs cursor-pointer group flex items-center gap-2 ${
                              selectedIconIdx === idx
                                ? "bg-orange-600/30 ring-1 ring-orange-500"
                                : "bg-zinc-800/50 hover:bg-zinc-700"
                            }`}
                          >
                            <span className="text-orange-400 font-bold w-4">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <span className="truncate text-zinc-300 block text-xs">
                                {icon.iconFileId || icon.label || <span className="text-zinc-500 italic">no id</span>}
                              </span>
                              {icon.iconFileId && icon.label && (
                                <span className="truncate text-zinc-500 text-[10px] block">
                                  {icon.label}
                                </span>
                              )}
                            </div>
                            {icon.required && (
                              <span className="text-orange-400 text-[10px]">REQ</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newIcons = el.icons!.filter((_, i) => i !== idx);
                                onUpdateElement(el.id, { icons: newIcons });
                                if (selectedIconIdx === idx) setSelectedIconIdx(null);
                                else if (selectedIconIdx !== null && idx < selectedIconIdx) {
                                  setSelectedIconIdx(selectedIconIdx - 1);
                                }
                              }}
                              className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 text-sm font-bold"
                              title="Delete icon"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
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

            {/* Parent IconList for icons */}
            {isIcon && iconListElements.length > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-600">
                <label className="text-xs text-zinc-400">Parent Icon List</label>
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
                  {iconListElements.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.text || p.type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Export checkbox for icons only (iconlists always export) */}
            {isIcon && (
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

            {/* Layout for iconlists */}
            {isIconList && (
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
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.varyN ?? false}
                      onChange={(e) =>
                        onUpdateElement(selectedElement.id, { varyN: e.target.checked })
                      }
                      className="w-3 h-3"
                    />
                    <span className="text-xs text-zinc-400">Vary N</span>
                  </label>
                </div>

                {/* Icon Size */}
                <div className="mt-3">
                  <label className="text-xs text-zinc-400 block mb-1">Icon Size (from center)</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500">Width</label>
                      <input
                        type="number"
                        value={selectedElement.iconWidth ?? ""}
                        onChange={(e) =>
                          onUpdateElement(selectedElement.id, {
                            iconWidth: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                        placeholder="auto"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-zinc-500">Height</label>
                      <input
                        type="number"
                        value={selectedElement.iconHeight ?? ""}
                        onChange={(e) =>
                          onUpdateElement(selectedElement.id, {
                            iconHeight: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                        placeholder="auto"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleIconPlacementMode?.();
                    }}
                    className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-medium ${
                      isIconPlacementMode
                        ? "bg-orange-600 hover:bg-orange-700 ring-2 ring-orange-400"
                        : "bg-zinc-700 hover:bg-zinc-600"
                    }`}
                  >
                    {isIconPlacementMode ? "✓ Click to place icons" : "Place Icon Centers"}
                  </button>
                </div>

                {/* Clear all icons button */}
                {selectedElement.icons && selectedElement.icons.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete all icons?")) {
                        onUpdateElement(selectedElement.id, { icons: [] });
                        setSelectedIconIdx(null);
                      }
                    }}
                    className="mt-3 text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30"
                  >
                    Clear All Icons
                  </button>
                )}

                {/* Selected icon editor */}
                {selectedIconIdx !== null && selectedElement.icons && selectedElement.icons[selectedIconIdx] && (
                  <div className="mt-3 pt-3 border-t border-zinc-600">
                    <div className="mb-2">
                      <label className="text-xs text-zinc-400 block">
                        Icon {selectedIconIdx + 1}
                      </label>
                      <span className="text-[10px] text-cyan-400 font-mono">
                        {selectedElement.icons[selectedIconIdx].elementId}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Icon File ID (for image lookup)</label>
                      <input
                        type="text"
                        value={selectedElement.icons[selectedIconIdx].iconFileId ?? ""}
                        onChange={(e) => {
                          const newIcons = [...selectedElement.icons!];
                          newIcons[selectedIconIdx] = { ...newIcons[selectedIconIdx], iconFileId: e.target.value || undefined };
                          onUpdateElement(selectedElement.id, { icons: newIcons });
                        }}
                        placeholder="e.g., od, edge, chrome"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Label (text below icon)</label>
                      <input
                        type="text"
                        value={selectedElement.icons[selectedIconIdx].label ?? ""}
                        onChange={(e) => {
                          const newIcons = [...selectedElement.icons!];
                          newIcons[selectedIconIdx] = { ...newIcons[selectedIconIdx], label: e.target.value || undefined };
                          onUpdateElement(selectedElement.id, { icons: newIcons });
                        }}
                        placeholder="optional, for desktop icons"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <div className="flex-1">
                        <label className="text-xs text-zinc-500">Center X</label>
                        <input
                          type="number"
                          value={Math.round(selectedElement.icons[selectedIconIdx].centerX)}
                          onChange={(e) => {
                            const newIcons = [...selectedElement.icons!];
                            newIcons[selectedIconIdx] = { ...newIcons[selectedIconIdx], centerX: parseInt(e.target.value) || 0 };
                            onUpdateElement(selectedElement.id, { icons: newIcons });
                          }}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-zinc-500">Center Y</label>
                        <input
                          type="number"
                          value={Math.round(selectedElement.icons[selectedIconIdx].centerY)}
                          onChange={(e) => {
                            const newIcons = [...selectedElement.icons!];
                            newIcons[selectedIconIdx] = { ...newIcons[selectedIconIdx], centerY: parseInt(e.target.value) || 0 };
                            onUpdateElement(selectedElement.id, { icons: newIcons });
                          }}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                    {selectedElement.varyN && (
                      <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={selectedElement.icons[selectedIconIdx].required ?? false}
                          onChange={(e) => {
                            const newIcons = [...selectedElement.icons!];
                            newIcons[selectedIconIdx] = { ...newIcons[selectedIconIdx], required: e.target.checked };
                            onUpdateElement(selectedElement.id, { icons: newIcons });
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-xs text-orange-400">Required (always shown)</span>
                      </label>
                    )}
                  </div>
                )}
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
                            onUpdateElement(selectedElement.id, { rows: undefined, rowHeights: undefined });
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num) && num >= 1 && num <= 50) {
                              const oldRows = selectedElement.rows || 1;
                              // Initialize heights if not set
                              const oldHeights = selectedElement.rowHeights && selectedElement.rowHeights.length === oldRows
                                ? [...selectedElement.rowHeights]
                                : Array(oldRows).fill(1 / oldRows);

                              let newHeights: number[];

                              if (num > oldRows) {
                                // Adding rows: take space from last row
                                const addCount = num - oldRows;
                                const lastHeight = oldHeights[oldRows - 1];
                                const splitHeight = lastHeight / (addCount + 1);
                                newHeights = [
                                  ...oldHeights.slice(0, -1),
                                  ...Array(addCount + 1).fill(splitHeight)
                                ];
                              } else if (num < oldRows) {
                                // Removing rows: give space to last remaining row
                                const removed = oldHeights.slice(num - 1);
                                const removedSum = removed.reduce((a, b) => a + b, 0);
                                newHeights = [
                                  ...oldHeights.slice(0, num - 1),
                                  removedSum
                                ];
                              } else {
                                newHeights = oldHeights;
                              }

                              onUpdateElement(selectedElement.id, {
                                rows: num,
                                rowHeights: newHeights
                              });
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const num = parseInt(e.target.value);
                          if (isNaN(num) || num < 1) {
                            onUpdateElement(selectedElement.id, { rows: 1, rowHeights: undefined });
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
                            onUpdateElement(selectedElement.id, { cols: undefined, colWidths: undefined });
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num) && num >= 1 && num <= 20) {
                              const oldCols = selectedElement.cols || 1;
                              // Initialize widths if not set
                              const oldWidths = selectedElement.colWidths && selectedElement.colWidths.length === oldCols
                                ? [...selectedElement.colWidths]
                                : Array(oldCols).fill(1 / oldCols);

                              let newWidths: number[];

                              if (num > oldCols) {
                                // Adding cols: take space from last column
                                const addCount = num - oldCols;
                                const lastWidth = oldWidths[oldCols - 1];
                                const splitWidth = lastWidth / (addCount + 1);
                                newWidths = [
                                  ...oldWidths.slice(0, -1),
                                  ...Array(addCount + 1).fill(splitWidth)
                                ];
                              } else if (num < oldCols) {
                                // Removing cols: give space to last remaining column
                                const removed = oldWidths.slice(num - 1);
                                const removedSum = removed.reduce((a, b) => a + b, 0);
                                newWidths = [
                                  ...oldWidths.slice(0, num - 1),
                                  removedSum
                                ];
                              } else {
                                newWidths = oldWidths;
                              }

                              onUpdateElement(selectedElement.id, {
                                cols: num,
                                colWidths: newWidths
                              });
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const num = parseInt(e.target.value);
                          if (isNaN(num) || num < 1) {
                            onUpdateElement(selectedElement.id, { cols: 1, colWidths: undefined });
                          }
                        }}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Grid task generation options */}
            {selectedElement.type === "grid" && (
              <div className="mt-2 pt-2 border-t border-zinc-600">
                <label className="text-xs text-zinc-400 block mb-2">Grid Options</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.ocr ?? false}
                      onChange={(e) =>
                        onUpdateElement(selectedElement.id, { ocr: e.target.checked })
                      }
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-zinc-300">OCR</span>
                    <span className="text-xs text-zinc-500">(transcribe on export)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.showGridLines ?? false}
                      onChange={(e) =>
                        onUpdateElement(selectedElement.id, { showGridLines: e.target.checked })
                      }
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-zinc-300">Show Grid Lines</span>
                    <span className="text-xs text-zinc-500">(on masked export)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.scrollable ?? false}
                      onChange={(e) => {
                        const updated = { ...selectedElement, scrollable: e.target.checked };
                        onUpdateElement(selectedElement.id, { scrollable: e.target.checked });
                        onUpdateGridTasks?.(updated);
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-zinc-300">Scrollable</span>
                    <span className="text-xs text-zinc-500">(scroll top/bottom/page)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.selectableRow ?? false}
                      onChange={(e) => {
                        const updated = { ...selectedElement, selectableRow: e.target.checked };
                        onUpdateElement(selectedElement.id, { selectableRow: e.target.checked });
                        onUpdateGridTasks?.(updated);
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-zinc-300">Selectable (Row)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedElement.selectableCell ?? false}
                      onChange={(e) => {
                        const updated = { ...selectedElement, selectableCell: e.target.checked };
                        onUpdateElement(selectedElement.id, { selectableCell: e.target.checked });
                        onUpdateGridTasks?.(updated);
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-zinc-300">Selectable (Cell)</span>
                  </label>
                </div>
                {(selectedElement.selectableRow || selectedElement.selectableCell) && (
                  <div className="mt-2">
                    <label className="text-xs text-zinc-400">Selection Color</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={selectedElement.selectionColor || "#3b82f6"}
                        onChange={(e) =>
                          onUpdateElement(selectedElement.id, { selectionColor: e.target.value })
                        }
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={selectedElement.selectionColor || "#3b82f6"}
                        onChange={(e) =>
                          onUpdateElement(selectedElement.id, { selectionColor: e.target.value })
                        }
                        className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loading element options */}
            {isLoading && (
              <div className="mt-2 pt-2 border-t border-zinc-600">
                <label className="text-xs text-zinc-400 block mb-2">Loading Indicator</label>

                {/* Image upload */}
                <div className="mb-3">
                  <label className="text-xs text-zinc-500 block mb-1">Spinner Image</label>
                  {selectedElement.loadingImage ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={selectedElement.loadingImage}
                        alt="Loading"
                        className="w-12 h-12 object-contain bg-zinc-900 rounded border border-zinc-600"
                      />
                      <button
                        onClick={() => onUpdateElement(selectedElement.id, { loadingImage: undefined })}
                        className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-zinc-600 rounded cursor-pointer hover:border-zinc-500 hover:bg-zinc-800/50">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target?.result as string;
                              onUpdateElement(selectedElement.id, { loadingImage: dataUrl });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <span className="text-xs text-zinc-500">Click to upload spinner image</span>
                    </label>
                  )}
                </div>

                {/* Wait time */}
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Wait Time (seconds)</label>
                  <input
                    type="number"
                    value={selectedElement.waitTime ?? 3}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        waitTime: Math.max(0.5, parseFloat(e.target.value) || 3)
                      })
                    }
                    min="0.5"
                    step="0.5"
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Task: Wait for loading indicator to disappear
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onDeleteElement(selectedElement.id)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
