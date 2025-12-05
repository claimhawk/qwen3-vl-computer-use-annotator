/**
 * CUDAG Service
 *
 * Handles communication with the cudag-server for generating
 * training datasets from annotations.
 */

import { Annotation } from "@/types/annotation";

const DEFAULT_SERVER_URL = "http://localhost:8420";

export interface GenerateOptions {
  projectName: string;
  outputDir?: string;
  numSamples?: number;
  generateImmediately?: boolean;
}

export interface GenerateResult {
  status: "success" | "error" | "generating";
  projectPath?: string;
  filesCreated?: string[];
  jobId?: string;
  error?: string;
}

export interface GenerationProgress {
  progress: number;
  total: number;
  currentTask?: string;
  done: boolean;
  error?: string;
}

export interface ServerHealth {
  status: "healthy" | "unhealthy";
  version?: string;
}

/**
 * Get the cudag-server URL from environment or use default.
 */
function getServerUrl(): string {
  if (typeof window !== "undefined") {
    // Client-side: check for env variable
    return process.env.NEXT_PUBLIC_CUDAG_SERVER_URL || DEFAULT_SERVER_URL;
  }
  return DEFAULT_SERVER_URL;
}

/**
 * Check if the cudag-server is available and healthy.
 */
export async function checkServerHealth(): Promise<ServerHealth> {
  try {
    const response = await fetch(`${getServerUrl()}/health`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      return { status: "unhealthy" };
    }

    const data = await response.json();
    return {
      status: "healthy",
      version: data.version,
    };
  } catch (error) {
    return { status: "unhealthy" };
  }
}

/**
 * Generate a CUDAG project from an annotation.
 *
 * @param annotation - The full annotation data
 * @param originalImage - Base64 encoded original image
 * @param maskedImage - Base64 encoded masked image (optional)
 * @param icons - Map of icon names to base64 encoded images (optional)
 * @param options - Generation options
 * @returns Generation result with job ID for tracking progress
 */
export async function generateProject(
  annotation: Annotation,
  originalImage: string,
  maskedImage?: string,
  icons?: Record<string, string>,
  options: GenerateOptions = { projectName: "generated-project" }
): Promise<GenerateResult> {
  try {
    const response = await fetch(`${getServerUrl()}/api/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        annotation,
        original_image: originalImage,
        masked_image: maskedImage,
        icons,
        options: {
          project_name: options.projectName,
          output_dir: options.outputDir,
          num_samples: options.numSamples,
          generate_immediately: options.generateImmediately ?? true,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        status: "error",
        error: errorData.detail || `Server error: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      status: data.status,
      projectPath: data.project_path,
      filesCreated: data.files_created,
      jobId: data.job_id,
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Failed to connect to cudag-server",
    };
  }
}

/**
 * Get the progress of a generation job.
 *
 * @param jobId - The job ID returned from generateProject
 * @returns Current progress information
 */
export async function getGenerationProgress(jobId: string): Promise<GenerationProgress> {
  try {
    const response = await fetch(`${getServerUrl()}/api/v1/status/${jobId}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      return {
        progress: 0,
        total: 0,
        done: true,
        error: `Failed to get status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      progress: data.progress,
      total: data.total,
      currentTask: data.current_task,
      done: data.done,
      error: data.error,
    };
  } catch (error) {
    return {
      progress: 0,
      total: 0,
      done: true,
      error: error instanceof Error ? error.message : "Failed to get progress",
    };
  }
}

/**
 * Convert an image URL to base64.
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      // Remove the data URL prefix to get pure base64
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      resolve(base64);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

/**
 * Convert a canvas to base64.
 */
export function canvasToBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}
