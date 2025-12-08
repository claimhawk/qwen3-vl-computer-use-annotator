/**
 * Custom hooks for the Annotator application
 *
 * These hooks extract state management logic from the main page component,
 * making the code more maintainable and testable.
 */

export { useAnnotationState } from "./useAnnotationState";
export type { UseAnnotationStateReturn } from "./useAnnotationState";

export { useImageState } from "./useImageState";
export type { UseImageStateReturn } from "./useImageState";

export { useToolState, useSyncToolWithSelection } from "./useToolState";
export type { UseToolStateReturn } from "./useToolState";

export { useViewState } from "./useViewState";
export type { UseViewStateReturn } from "./useViewState";

export { useDataTypes } from "./useDataTypes";
