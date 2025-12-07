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

// All available actions
const TASK_ACTIONS: { value: TaskAction | "auto"; label: string; needsTarget: boolean; needsText: boolean }[] = [
  { value: "auto", label: "Auto (from element)", needsTarget: true, needsText: false },
  { value: "left_click", label: "Left Click", needsTarget: true, needsText: false },
  { value: "double_click", label: "Double Click", needsTarget: true, needsText: false },
  { value: "triple_click", label: "Triple Click", needsTarget: true, needsText: false },
  { value: "right_click", label: "Right Click", needsTarget: true, needsText: false },
  { value: "middle_click", label: "Middle Click", needsTarget: true, needsText: false },
  { value: "left_click_drag", label: "Left Click Drag", needsTarget: true, needsText: false },
  { value: "mouse_move", label: "Mouse Move", needsTarget: true, needsText: false },
  { value: "type", label: "Type Text", needsTarget: true, needsText: true },
  { value: "key", label: "Press Key", needsTarget: false, needsText: true },
  { value: "scroll", label: "Scroll (vertical)", needsTarget: true, needsText: false },
  { value: "hscroll", label: "Scroll (horizontal)", needsTarget: true, needsText: false },
  { value: "wait", label: "Wait", needsTarget: false, needsText: false },
  { value: "terminate", label: "Terminate", needsTarget: false, needsText: false },
  { value: "answer", label: "Answer", needsTarget: false, needsText: true },
];

// Get action label - explicit action or inferred from element type
function getActionLabel(task: Task, element: UIElement | undefined): string {
  if (task.action) {
    const actionDef = TASK_ACTIONS.find(a => a.value === task.action);
    return actionDef?.label || task.action;
  }
  if (!element) return "—";
  if (element.type === "textinput") return "click → type";
  return "left_click";
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

  // Get current action config
  const currentAction = selectedTask?.action || "auto";
  const actionConfig = TASK_ACTIONS.find(a => a.value === currentAction);
  const needsTarget = actionConfig?.needsTarget ?? true;
  const needsText = actionConfig?.needsText || (currentAction === "auto" && targetElement?.type === "textinput");

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
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        {task.prompt || "(no prompt)"}
                      </div>
                      {task.taskType && (
                        <div className="text-[10px] text-cyan-400 truncate">
                          {task.taskType}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500 flex-shrink-0">
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
              <label className="text-xs text-zinc-400">Task Type</label>
              <input
                type="text"
                value={selectedTask.taskType ?? ""}
                onChange={(e) =>
                  onUpdateTask(selectedTask.id, { taskType: e.target.value || undefined })
                }
                placeholder="e.g., click_button_[label], scroll-grid-direction"
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400">Action</label>
              <select
                value={selectedTask.action || "auto"}
                onChange={(e) => {
                  const action = e.target.value === "auto" ? undefined : e.target.value as TaskAction;
                  const newActionConfig = TASK_ACTIONS.find(a => a.value === (action || "auto"));
                  onUpdateTask(selectedTask.id, {
                    action,
                    targetElementId: newActionConfig?.needsTarget ? selectedTask.targetElementId : undefined,
                    text: newActionConfig?.needsText ? selectedTask.text : undefined,
                  });
                }}
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
              >
                <optgroup label="Mouse Actions">
                  <option value="auto">Auto (from element)</option>
                  <option value="left_click">Left Click</option>
                  <option value="double_click">Double Click</option>
                  <option value="triple_click">Triple Click</option>
                  <option value="right_click">Right Click</option>
                  <option value="middle_click">Middle Click</option>
                  <option value="left_click_drag">Left Click Drag</option>
                  <option value="mouse_move">Mouse Move</option>
                </optgroup>
                <optgroup label="Keyboard">
                  <option value="type">Type Text</option>
                  <option value="key">Press Key</option>
                </optgroup>
                <optgroup label="Scroll">
                  <option value="scroll">Scroll (vertical)</option>
                  <option value="hscroll">Scroll (horizontal)</option>
                </optgroup>
                <optgroup label="Control">
                  <option value="wait">Wait</option>
                  <option value="terminate">Terminate</option>
                  <option value="answer">Answer</option>
                </optgroup>
              </select>
            </div>

            {needsTarget && (
              <div>
                <label className="text-xs text-zinc-400">Target Element</label>
                <select
                  value={selectedTask.targetElementId || ""}
                  onChange={(e) =>
                    onUpdateTask(selectedTask.id, {
                      targetElementId: e.target.value || undefined,
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

            {/* Text input - for type/answer actions */}
            {(currentAction === "type" || currentAction === "answer" || (currentAction === "auto" && targetElement?.type === "textinput")) && (
              <div>
                <label className="text-xs text-zinc-400">
                  {currentAction === "answer" ? "Answer" : "Text to Type"}
                </label>
                <input
                  type="text"
                  value={selectedTask.text ?? ""}
                  onChange={(e) =>
                    onUpdateTask(selectedTask.id, { text: e.target.value })
                  }
                  placeholder={currentAction === "answer" ? "e.g., The answer is 42" : "e.g., hello@example.com"}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                />
              </div>
            )}

            {/* Keys input - for key action */}
            {currentAction === "key" && (
              <div>
                <label className="text-xs text-zinc-400">Keys (comma separated)</label>
                <input
                  type="text"
                  value={(selectedTask.keys ?? []).join(", ")}
                  onChange={(e) => {
                    const keys = e.target.value.split(",").map(k => k.trim()).filter(Boolean);
                    onUpdateTask(selectedTask.id, { keys });
                  }}
                  placeholder="e.g., ctrl, c or Return or Escape"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Common: Return, Escape, Tab, Backspace, ctrl, alt, shift, cmd
                </p>
              </div>
            )}

            {/* Pixels input - for scroll/hscroll */}
            {(currentAction === "scroll" || currentAction === "hscroll") && (
              <div>
                <label className="text-xs text-zinc-400">
                  Pixels ({currentAction === "scroll" ? "+down/-up" : "+right/-left"})
                </label>
                <input
                  type="number"
                  value={selectedTask.pixels ?? ""}
                  onChange={(e) =>
                    onUpdateTask(selectedTask.id, { pixels: parseInt(e.target.value) || undefined })
                  }
                  placeholder="e.g., 100 or -100"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                />
              </div>
            )}

            {/* Wait time - for wait action */}
            {currentAction === "wait" && (
              <div>
                <label className="text-xs text-zinc-400">Wait Time (seconds)</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedTask.waitTime ?? ""}
                  onChange={(e) =>
                    onUpdateTask(selectedTask.id, { waitTime: parseFloat(e.target.value) || undefined })
                  }
                  placeholder="e.g., 2.5"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                />
              </div>
            )}

            {/* Status - for terminate action */}
            {currentAction === "terminate" && (
              <div>
                <label className="text-xs text-zinc-400">Status</label>
                <select
                  value={selectedTask.status ?? "success"}
                  onChange={(e) =>
                    onUpdateTask(selectedTask.id, { status: e.target.value as "success" | "failure" })
                  }
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                >
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                </select>
              </div>
            )}

            {/* Drag coordinates - for left_click_drag */}
            {currentAction === "left_click_drag" && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-zinc-400">End Element (drag to)</label>
                  <select
                    value={selectedTask.endCoordinate ? "" : (selectedTask as any).endElementId || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        const el = elements.find(el => el.id === e.target.value);
                        if (el) {
                          const endX = Math.round(el.bbox.x + el.bbox.width / 2);
                          const endY = Math.round(el.bbox.y + el.bbox.height / 2);
                          onUpdateTask(selectedTask.id, { endCoordinate: [endX, endY] });
                        }
                      }
                    }}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm"
                  >
                    <option value="">-- Select end element --</option>
                    {elements.map((el) => (
                      <option key={el.id} value={el.id}>
                        {el.text || el.type} ({el.type})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedTask.endCoordinate && (
                  <p className="text-xs text-zinc-500">
                    End: [{selectedTask.endCoordinate[0]}, {selectedTask.endCoordinate[1]}]
                  </p>
                )}
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
