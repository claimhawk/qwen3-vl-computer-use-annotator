"use client";

import { Task, UIElement, ElementPriorState, TaskAction } from "@/types/annotation";

interface Props {
  tasks: Task[];
  elements: UIElement[];
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onAddTask: () => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

// Get action label - explicit action or inferred from element type
function getActionLabel(task: Task, element: UIElement | undefined): string {
  if (task.action === "wait") return "wait";
  if (!element) return "—";
  if (element.type === "textinput") return "click → type";
  return "click";
}

export default function TaskList({
  tasks,
  elements,
  selectedTaskId,
  onSelectTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: Props) {
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const targetElement = selectedTask
    ? elements.find((el) => el.id === selectedTask.targetElementId)
    : null;
  const isTextInput = targetElement?.type === "textinput";
  const isWaitAction = selectedTask?.action === "wait";

  // Panel types for prior states visibility
  const panelTypes = ["panel", "dialog", "toolbar", "menubar"];

  return (
    <div className="flex flex-col h-full">
      {/* Task list - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="flex justify-end mb-2">
            <button
              onClick={onAddTask}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1"
            >
              + Add Task
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="text-xs text-zinc-500 px-1">
              Add tasks to create training samples
            </p>
          ) : (
            <ul className="space-y-0.5">
              {tasks.map((task, idx) => {
                const el = elements.find((e) => e.id === task.targetElementId);
                return (
                  <li
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className={`
                      flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm
                      ${task.id === selectedTaskId ? "bg-zinc-700" : "hover:bg-zinc-800"}
                    `}
                  >
                    <span className="text-zinc-500 text-xs w-4">{idx + 1}.</span>
                    <span className="flex-1 truncate">
                      {task.prompt || "(no prompt)"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {getActionLabel(task, el)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Selected task editor - fixed at bottom */}
      {selectedTask && (
        <div className="p-3 border-t border-zinc-700 bg-zinc-800 max-h-[50%] overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2">Edit Task</h3>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-zinc-400">Action</label>
              <select
                value={selectedTask.action || "auto"}
                onChange={(e) => {
                  const action = e.target.value === "auto" ? undefined : e.target.value as TaskAction;
                  onUpdateTask(selectedTask.id, {
                    action,
                    targetElementId: action === "wait" ? undefined : selectedTask.targetElementId,
                  });
                }}
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
              >
                <option value="auto">Auto (from element)</option>
                <option value="wait">Wait (for loading/dialog)</option>
              </select>
            </div>

            {!isWaitAction && (
              <div>
                <label className="text-xs text-zinc-400">Target Element</label>
                <select
                  value={selectedTask.targetElementId || ""}
                  onChange={(e) =>
                    onUpdateTask(selectedTask.id, {
                      targetElementId: e.target.value || undefined,
                      text: undefined, // Clear text when target changes
                    })
                  }
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                >
                  <option value="">-- Select element --</option>
                  {elements.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.text || el.type} ({el.type})
                    </option>
                  ))}
                </select>
                {targetElement && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Action: <span className="text-zinc-300">{getActionLabel(selectedTask, targetElement)}</span>
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="text-xs text-zinc-400">Prompt</label>
              <textarea
                value={selectedTask.prompt}
                onChange={(e) =>
                  onUpdateTask(selectedTask.id, { prompt: e.target.value })
                }
                placeholder="e.g., Click the OK button"
                rows={2}
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm resize-none"
              />
            </div>

            {/* Text to type - only for textinput elements */}
            {isTextInput && (
              <div>
                <label className="text-xs text-zinc-400">Text to Type</label>
                <input
                  type="text"
                  value={selectedTask.text ?? ""}
                  onChange={(e) =>
                    onUpdateTask(selectedTask.id, { text: e.target.value })
                  }
                  placeholder="e.g., PASSWORD"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Generates: click + type
                </p>
              </div>
            )}

            {/* Prior States - element states before this action */}
            <div className="mt-2 pt-2 border-t border-zinc-600">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-zinc-400">Prior States</label>
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const el = elements.find((el) => el.id === e.target.value);
                    if (!el) return;
                    const existing = selectedTask.priorStates ?? [];
                    if (existing.some((ps) => ps.elementId === el.id)) return;
                    // Default visibility to true for panels
                    const isPanel = panelTypes.includes(el.type);
                    const newState: ElementPriorState = {
                      elementId: el.id,
                      visible: isPanel ? true : undefined,
                    };
                    onUpdateTask(selectedTask.id, {
                      priorStates: [...existing, newState],
                    });
                  }}
                  className="text-xs bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5"
                >
                  <option value="">+ Add element...</option>
                  <optgroup label="Panels (visibility)">
                    {elements
                      .filter(
                        (el) =>
                          panelTypes.includes(el.type) &&
                          !(selectedTask.priorStates ?? []).some((ps) => ps.elementId === el.id)
                      )
                      .map((el) => (
                        <option key={el.id} value={el.id}>
                          {el.text || el.type}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Inputs (state)">
                    {elements
                      .filter(
                        (el) =>
                          ["textinput", "dropdown", "listbox", "checkbox", "radio"].includes(el.type) &&
                          !(selectedTask.priorStates ?? []).some((ps) => ps.elementId === el.id)
                      )
                      .map((el) => (
                        <option key={el.id} value={el.id}>
                          {el.text || el.type}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {(selectedTask.priorStates ?? []).length === 0 ? (
                <p className="text-xs text-zinc-500">No prior states set</p>
              ) : (
                <div className="space-y-2">
                  {(selectedTask.priorStates ?? []).map((ps) => {
                    const el = elements.find((e) => e.id === ps.elementId);
                    if (!el) return null;
                    const isText = el.type === "textinput";
                    const isList = el.type === "dropdown" || el.type === "listbox";
                    const isCheck = el.type === "checkbox" || el.type === "radio";
                    const isPanel = panelTypes.includes(el.type);

                    const updatePriorState = (updates: Partial<ElementPriorState>) => {
                      const newStates = (selectedTask.priorStates ?? []).map((s) =>
                        s.elementId === ps.elementId ? { ...s, ...updates } : s
                      );
                      onUpdateTask(selectedTask.id, { priorStates: newStates });
                    };

                    const removePriorState = () => {
                      const newStates = (selectedTask.priorStates ?? []).filter(
                        (s) => s.elementId !== ps.elementId
                      );
                      onUpdateTask(selectedTask.id, { priorStates: newStates });
                    };

                    return (
                      <div key={ps.elementId} className="bg-zinc-700 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{el.text || el.type}</span>
                          <button
                            onClick={removePriorState}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            ×
                          </button>
                        </div>

                        {isPanel && (
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={ps.visible ?? false}
                              onChange={(e) => updatePriorState({ visible: e.target.checked })}
                              className="w-3 h-3"
                            />
                            Visible (unmask in export)
                          </label>
                        )}

                        {isText && (
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={ps.filled ?? false}
                              onChange={(e) => updatePriorState({ filled: e.target.checked })}
                              className="w-3 h-3"
                            />
                            Has text filled
                          </label>
                        )}

                        {isList && (
                          <>
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={ps.open ?? false}
                                onChange={(e) => updatePriorState({ open: e.target.checked })}
                                className="w-3 h-3"
                              />
                              Open/expanded
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={ps.hasSelection ?? false}
                                onChange={(e) => updatePriorState({ hasSelection: e.target.checked })}
                                className="w-3 h-3"
                              />
                              Has selection
                            </label>
                          </>
                        )}

                        {isCheck && (
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={ps.checked ?? false}
                              onChange={(e) => updatePriorState({ checked: e.target.checked })}
                              className="w-3 h-3"
                            />
                            Checked
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => onDeleteTask(selectedTask.id)}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-sm mt-2"
            >
              Delete Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
