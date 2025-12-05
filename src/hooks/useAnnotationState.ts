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
      targetElementId: element.id,
      action: "scroll" as TaskAction,
      pixels: -9999,
    },
    {
      id: `${element.id}${SCROLL_TASK_PREFIX}bottom`,
      prompt: `Scroll to the bottom of the ${name}`,
      targetElementId: element.id,
      action: "scroll" as TaskAction,
      pixels: 9999,
    },
    {
      id: `${element.id}${SCROLL_TASK_PREFIX}up`,
      prompt: `Scroll up on the ${name}`,
      targetElementId: element.id,
      action: "scroll" as TaskAction,
      pixels: -Math.round(element.bbox.height),
    },
    {
      id: `${element.id}${SCROLL_TASK_PREFIX}down`,
      prompt: `Scroll down on the ${name}`,
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
function generateSelectTasks(element: UIElement, elementName?: string): Task[] {
  const name = elementName || element.text || "table";

  return [
    {
      id: `${element.id}${SELECT_TASK_PREFIX}row`,
      prompt: `Click the [n] row of the ${name} to select it`,
      targetElementId: element.id,
      action: "left_click" as TaskAction,
    },
  ];
}

/**
 * Generate click task for a button element.
 */
function generateClickTask(element: UIElement): Task {
  const name = element.text || "button";
  return {
    id: `${element.id}${CLICK_TASK_PREFIX}`,
    prompt: `Click the ${name} button`,
    targetElementId: element.id,
    action: "left_click" as TaskAction,
  };
}

// Element types that automatically get click tasks
const AUTO_CLICK_TYPES = ["button", "checkbox", "radio", "tab"];

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

      // If text changed on a clickable element, update the auto-generated task prompt
      if (updates.text !== undefined) {
        const element = updated.find((el) => el.id === id);
        if (element && AUTO_CLICK_TYPES.includes(element.type)) {
          const taskId = `${id}${CLICK_TASK_PREFIX}`;
          const newPrompt = `Click the ${updates.text || "button"} button`;
          setTasks((prevTasks) =>
            prevTasks.map((t) =>
              t.id === taskId ? { ...t, prompt: newPrompt } : t
            )
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
      !t.id.startsWith(id + CLICK_TASK_PREFIX)
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
            t.id.startsWith(id + CLICK_TASK_PREFIX)) {
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

      // Add selection tasks if selectable is checked
      const selectTasks = element.selectable ? generateSelectTasks(element) : [];

      return [...filtered, ...scrollTasks, ...selectTasks];
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
    updateTask,
    deleteTask,
    selectTask,
    setTasks,

    // Bulk operations
    clearAll,
    loadAnnotation,
  };
}
