/**
 * useAnnotationState - Manages elements and tasks state
 *
 * This hook extracts all element and task management logic from the main page
 * component, providing a clean interface for annotation operations.
 */

import { useState, useCallback } from "react";
import { UIElement, Task, TaskAction } from "@/types/annotation";

// Task ID prefixes for auto-generated tasks
const SCROLL_TASK_PREFIX = "_scroll_";
const SELECT_TASK_PREFIX = "_select_";
const CLICK_TASK_PREFIX = "_click_";
const ICON_TASK_PREFIX = "_icon_";
const DROPDOWN_OPEN_TASK_PREFIX = "_dropdown_open_";
const DROPDOWN_SELECT_TASK_PREFIX = "_dropdown_select_";
const TEXTINPUT_TASK_PREFIX = "_textinput_";

/**
 * Convert a name to kebab-case for taskType.
 * Replaces spaces and underscores with hyphens, converts to lowercase.
 */
function toKebabCase(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, "-");
}

/**
 * Generate scroll tasks for a grid element.
 * Creates: scroll to top, scroll to bottom, scroll up 1 page, scroll down 1 page
 */
function generateScrollTasks(element: UIElement, elementName?: string): Task[] {
  const name = elementName || element.text || "list";
  return [
    {
      id: `${element.id}${SCROLL_TASK_PREFIX}top`,
      prompt: `Scroll to the top of the ${name}`,
      taskType: "scroll-top",
      targetElementId: element.id,
      action: "scroll" as TaskAction,
      pixels: -9999,
    },
    {
      id: `${element.id}${SCROLL_TASK_PREFIX}bottom`,
      prompt: `Scroll to the bottom of the ${name}`,
      taskType: "scroll-bottom",
      targetElementId: element.id,
      action: "scroll" as TaskAction,
      pixels: 9999,
    },
    {
      id: `${element.id}${SCROLL_TASK_PREFIX}up`,
      prompt: `Scroll up on the ${name}`,
      taskType: "scroll-up",
      targetElementId: element.id,
      action: "scroll" as TaskAction,
      pixels: -Math.round(element.bbox.height),
    },
    {
      id: `${element.id}${SCROLL_TASK_PREFIX}down`,
      prompt: `Scroll down on the ${name}`,
      taskType: "scroll-down",
      targetElementId: element.id,
      action: "scroll" as TaskAction,
      pixels: Math.round(element.bbox.height),
    },
  ];
}

/**
 * Generate row selection task for a grid element.
 * Creates: click the [n] row to select it (single task with [n] placeholder)
 */
function generateSelectRowTask(element: UIElement, elementName?: string): Task {
  const name = elementName || element.text || "table";
  return {
    id: `${element.id}${SELECT_TASK_PREFIX}row`,
    prompt: `Click the [n] row of the ${name} to select it`,
    targetElementId: element.id,
    action: "left_click" as TaskAction,
  };
}

/**
 * Generate cell selection task for a grid element.
 * Creates: click the cell at row [r], column [c]
 * Uses left_click at center with 70% tolerance (toleranceX/toleranceY)
 */
function generateSelectCellTask(element: UIElement, elementName?: string): Task {
  const name = elementName || element.text || "table";
  return {
    id: `${element.id}${SELECT_TASK_PREFIX}cell`,
    prompt: `Click the cell at row [r], column [c] in the ${name}`,
    targetElementId: element.id,
    action: "left_click" as TaskAction,
  };
}

/**
 * Generate click task for a button element.
 */
function generateClickTask(element: UIElement): Task {
  const label = element.text || "button";
  const taskType = `click-${toKebabCase(element.type)}-${toKebabCase(label)}`;
  return {
    id: `${element.id}${CLICK_TASK_PREFIX}`,
    prompt: `Click the ${label} ${element.type}`,
    taskType,
    targetElementId: element.id,
    action: "left_click" as TaskAction,
  };
}

/**
 * Generate template task for an iconlist.
 * Format: "Double click the [icon_label] icon to open [icon_label]"
 * This single task template will be expanded at generation time for each icon.
 */
function generateIconListTask(elementId: string): Task {
  return {
    id: `${elementId}${ICON_TASK_PREFIX}`,
    prompt: `Double click the [icon_label] icon to open [icon_label]`,
    taskType: "open-icon-[icon_label]",
    targetElementId: elementId,
    action: "double_click" as TaskAction,
  };
}

/**
 * Generate wait task for a loading element.
 */
function generateWaitTask(element: UIElement): Task {
  const waitTime = element.waitTime ?? 3;
  const label = element.text || "loading";
  return {
    id: `${element.id}_wait`,
    prompt: `Wait for loading indicator to disappear`,
    taskType: `wait-${toKebabCase(label)}`,
    targetElementId: element.id,
    action: "wait" as TaskAction,
    waitTime: waitTime,
  };
}

/**
 * Generate tasks for a dropdown element.
 * Creates:
 * - "Click the [dropdownname] to open" (open task)
 * - "Select the [n]th item labeled \"[optionvalue]\" from the [dropdownname]" (selection template task)
 */
function generateDropdownTasks(element: UIElement): Task[] {
  const name = element.text || "dropdown";
  const kebabName = toKebabCase(name);
  return [
    {
      id: `${element.id}${DROPDOWN_OPEN_TASK_PREFIX}`,
      prompt: `Click the ${name} to open`,
      taskType: `click-dropdown-${kebabName}`,
      targetElementId: element.id,
      action: "left_click" as TaskAction,
    },
    {
      id: `${element.id}${DROPDOWN_SELECT_TASK_PREFIX}`,
      prompt: `Select the [n]th item labeled "[optionvalue]" from the ${name}`,
      taskType: `select-dropdown-${kebabName}`,
      targetElementId: element.id,
      action: "left_click" as TaskAction,
    },
  ];
}

/**
 * Generate a single task template for a text input element.
 * This single task will produce two tool calls at generation time:
 * 1. left_click on the field (using targetElementId coordinates)
 * 2. type the [value]
 * Format: "Click the [fieldname] field\nType [value]"
 */
function generateTextInputTask(element: UIElement): Task {
  const name = element.text || "field";
  return {
    id: `${element.id}${TEXTINPUT_TASK_PREFIX}`,
    prompt: `Click the ${name} field\nType [value]`,
    taskType: `fill-textinput-${toKebabCase(name)}`,
    targetElementId: element.id,
    action: "click_type" as TaskAction,
    text: "[value]",
  };
}

// Element types that automatically get click tasks
const AUTO_CLICK_TYPES = ["button", "checkbox", "radio", "tab"];

// Element types that automatically get wait tasks
const AUTO_WAIT_TYPES = ["loading"];

export interface UseAnnotationStateReturn {
  // Elements
  elements: UIElement[];
  selectedElementId: string | null;
  addElement: (element: UIElement) => void;
  updateElement: (id: string, updates: Partial<UIElement>) => void;
  deleteElement: (id: string) => void;
  deleteElements: (ids: string[]) => void;
  selectElement: (id: string | null) => void;
  setElements: React.Dispatch<React.SetStateAction<UIElement[]>>;

  // Tasks
  tasks: Task[];
  selectedTaskId: string | null;
  addTask: () => void;
  autoGenerateTasks: (element: UIElement) => void;  // Auto-generate tasks when element is created
  updateGridTasks: (element: UIElement) => void;  // Update tasks based on grid scrollable/selectable flags
  ensureIconListTask: (elementId: string) => void;  // Ensure iconlist has its task template
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  selectTask: (id: string | null) => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;

  // Bulk operations
  clearAll: () => void;
  loadAnnotation: (elements: readonly UIElement[], tasks: readonly Task[]) => void;
}

export function useAnnotationState(): UseAnnotationStateReturn {
  const [elements, setElements] = useState<UIElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Auto-generate tasks when element is created (called from canvas)
  const autoGenerateTasks = useCallback((element: UIElement) => {
    if (AUTO_CLICK_TYPES.includes(element.type)) {
      const clickTask = generateClickTask(element);
      setTasks((prev) => [...prev, clickTask]);
    } else if (AUTO_WAIT_TYPES.includes(element.type)) {
      const waitTask = generateWaitTask(element);
      setTasks((prev) => [...prev, waitTask]);
    } else if (element.type === "dropdown") {
      const dropdownTasks = generateDropdownTasks(element);
      setTasks((prev) => [...prev, ...dropdownTasks]);
    } else if (element.type === "textinput") {
      const textInputTask = generateTextInputTask(element);
      setTasks((prev) => [...prev, textInputTask]);
    }
  }, []);

  // Element operations
  const addElement = useCallback((element: UIElement) => {
    setElements((prev) => [...prev, element]);
    autoGenerateTasks(element);
  }, [autoGenerateTasks]);

  const updateElement = useCallback((id: string, updates: Partial<UIElement>) => {
    setElements((prev) => {
      const updated = prev.map((el) => (el.id === id ? { ...el, ...updates } : el));

      // If text changed on a clickable element, update the auto-generated task prompt and taskType
      if (updates.text !== undefined) {
        const element = updated.find((el) => el.id === id);
        if (element && AUTO_CLICK_TYPES.includes(element.type)) {
          const taskId = `${id}${CLICK_TASK_PREFIX}`;
          const label = updates.text || "button";
          const newPrompt = `Click the ${label} ${element.type}`;
          const newTaskType = `click-${toKebabCase(element.type)}-${toKebabCase(label)}`;
          setTasks((prevTasks) =>
            prevTasks.map((t) =>
              t.id === taskId ? { ...t, prompt: newPrompt, taskType: newTaskType } : t
            )
          );
        }
        // Update dropdown task prompts when dropdown label changes
        if (element && element.type === "dropdown") {
          const name = updates.text || "dropdown";
          const kebabName = toKebabCase(name);
          const openTaskId = `${id}${DROPDOWN_OPEN_TASK_PREFIX}`;
          const selectTaskId = `${id}${DROPDOWN_SELECT_TASK_PREFIX}`;
          setTasks((prevTasks) =>
            prevTasks.map((t) => {
              if (t.id === openTaskId) {
                return { ...t, prompt: `Click the ${name} to open`, taskType: `click-dropdown-${kebabName}` };
              }
              if (t.id === selectTaskId) {
                return { ...t, prompt: `Select the [n]th item labeled "[optionvalue]" from the ${name}`, taskType: `select-dropdown-${kebabName}` };
              }
              return t;
            })
          );
        }
        // Update text input task prompt when label changes
        if (element && element.type === "textinput") {
          const name = updates.text || "field";
          const taskId = `${id}${TEXTINPUT_TASK_PREFIX}`;
          setTasks((prevTasks) =>
            prevTasks.map((t) => {
              if (t.id === taskId) {
                return { ...t, prompt: `Click the ${name} field\nType [value]`, taskType: `fill-textinput-${toKebabCase(name)}` };
              }
              return t;
            })
          );
        }
      }

      return updated;
    });
  }, []);

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedElementId((prev) => (prev === id ? null : prev));

    // Also delete any auto-generated tasks for this element
    setTasks((prev) => prev.filter((t) =>
      !t.id.startsWith(id + SCROLL_TASK_PREFIX) &&
      !t.id.startsWith(id + SELECT_TASK_PREFIX) &&
      !t.id.startsWith(id + CLICK_TASK_PREFIX) &&
      !t.id.startsWith(id + DROPDOWN_OPEN_TASK_PREFIX) &&
      !t.id.startsWith(id + DROPDOWN_SELECT_TASK_PREFIX) &&
      !t.id.startsWith(id + TEXTINPUT_TASK_PREFIX)
    ));
  }, []);

  const deleteElements = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setElements((prev) => prev.filter((el) => !idSet.has(el.id)));
    setSelectedElementId((prev) => (prev && idSet.has(prev) ? null : prev));

    // Also delete any auto-generated tasks for these elements
    setTasks((prev) => prev.filter((t) => {
      for (const id of ids) {
        if (t.id.startsWith(id + SCROLL_TASK_PREFIX) ||
            t.id.startsWith(id + SELECT_TASK_PREFIX) ||
            t.id.startsWith(id + CLICK_TASK_PREFIX) ||
            t.id.startsWith(id + DROPDOWN_OPEN_TASK_PREFIX) ||
            t.id.startsWith(id + DROPDOWN_SELECT_TASK_PREFIX) ||
            t.id.startsWith(id + TEXTINPUT_TASK_PREFIX)) {
          return false;
        }
      }
      return true;
    }));
  }, []);

  const selectElement = useCallback((id: string | null) => {
    setSelectedElementId(id);
  }, []);

  // Task operations
  const addTask = useCallback(() => {
    const newTask: Task = {
      id: `task_${Date.now()}`,
      prompt: "",
      targetElementId: "",
    };
    setTasks((prev) => [...prev, newTask]);
    setSelectedTaskId(newTask.id);
  }, []);

  // Update tasks based on grid scrollable/selectable flags
  // Adds or removes tasks as needed when checkboxes are toggled
  const updateGridTasks = useCallback((element: UIElement) => {
    if (element.type !== "grid") return;

    setTasks((prev) => {
      // Remove existing auto-generated tasks for this element
      const filtered = prev.filter(
        (t) => !t.id.startsWith(element.id + SCROLL_TASK_PREFIX) &&
               !t.id.startsWith(element.id + SELECT_TASK_PREFIX)
      );

      // Add scroll tasks if scrollable is checked
      const scrollTasks = element.scrollable ? generateScrollTasks(element) : [];

      // Add row selection task if selectableRow is checked
      const rowSelectTask = element.selectableRow ? [generateSelectRowTask(element)] : [];

      // Add cell selection task if selectableCell is checked
      const cellSelectTask = element.selectableCell ? [generateSelectCellTask(element)] : [];

      return [...filtered, ...scrollTasks, ...rowSelectTask, ...cellSelectTask];
    });
  }, []);

  // Ensure iconlist has its task template (only adds if not already present)
  const ensureIconListTask = useCallback((elementId: string) => {
    setTasks((prev) => {
      const taskId = `${elementId}${ICON_TASK_PREFIX}`;
      // Check if task already exists
      if (prev.some((t) => t.id === taskId)) {
        return prev;
      }
      // Add the template task
      return [...prev, generateIconListTask(elementId)];
    });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTaskId((prev) => (prev === id ? null : prev));
  }, []);

  const selectTask = useCallback((id: string | null) => {
    setSelectedTaskId(id);
  }, []);

  // Bulk operations
  const clearAll = useCallback(() => {
    setElements([]);
    setSelectedElementId(null);
    setTasks([]);
    setSelectedTaskId(null);
  }, []);

  const loadAnnotation = useCallback((newElements: readonly UIElement[], newTasks: readonly Task[]) => {
    setElements([...newElements]);
    setTasks([...newTasks]);
    setSelectedElementId(null);
    setSelectedTaskId(null);
  }, []);

  return {
    // Elements
    elements,
    selectedElementId,
    addElement,
    updateElement,
    deleteElement,
    deleteElements,
    selectElement,
    setElements,

    // Tasks
    tasks,
    selectedTaskId,
    addTask,
    autoGenerateTasks,
    updateGridTasks,
    ensureIconListTask,
    updateTask,
    deleteTask,
    selectTask,
    setTasks,

    // Bulk operations
    clearAll,
    loadAnnotation,
  };
}
