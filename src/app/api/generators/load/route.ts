import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";

// Path to generators directory
const GENERATORS_PATH = path.resolve(process.cwd(), "../generators");

// Generate a unique ID for icons that don't have one
function generateElementId(): string {
  return `icon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Ensure all icons in iconlists have elementId
function ensureIconElementIds(annotation: Record<string, unknown>): Record<string, unknown> {
  const elements = annotation.elements as Array<Record<string, unknown>> | undefined;
  if (!elements) return annotation;

  const updatedElements = elements.map((el) => {
    // Check if this is an iconlist-type element with icons
    if (["iconlist", "toolbar", "menubar"].includes(el.type as string) && Array.isArray(el.icons)) {
      const updatedIcons = (el.icons as Array<Record<string, unknown>>).map((icon) => {
        if (!icon.elementId) {
          return { ...icon, elementId: generateElementId() };
        }
        return icon;
      });
      return { ...el, icons: updatedIcons };
    }
    return el;
  });

  return { ...annotation, elements: updatedElements };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const generatorName = searchParams.get("generator");

    if (!generatorName) {
      return NextResponse.json(
        { error: "Generator name is required" },
        { status: 400 }
      );
    }

    // Build paths
    const generatorPath = path.join(GENERATORS_PATH, generatorName);
    const annotationsPath = path.join(generatorPath, "assets", "annotations");
    const annotationJsonPath = path.join(annotationsPath, "annotation.json");
    const configZipPath = path.join(generatorPath, "config", "annotated.zip");

    let annotation: Record<string, unknown> | null = null;
    let imageDataUrl: string | null = null;

    // Try loading from assets/annotations/ first
    try {
      await fs.access(annotationJsonPath);

      // Read annotation.json
      const annotationData = await fs.readFile(annotationJsonPath, "utf-8");
      annotation = JSON.parse(annotationData);

      // Read original image
      const originalImagePath = path.join(annotationsPath, "original.png");
      try {
        const imageBuffer = await fs.readFile(originalImagePath);
        const base64 = imageBuffer.toString("base64");
        imageDataUrl = `data:image/png;base64,${base64}`;
      } catch {
        // Try jpg as fallback
        try {
          const jpgPath = path.join(annotationsPath, "original.jpg");
          const imageBuffer = await fs.readFile(jpgPath);
          const base64 = imageBuffer.toString("base64");
          imageDataUrl = `data:image/jpeg;base64,${base64}`;
        } catch {
          // No image found
        }
      }
    } catch {
      // Try loading from config/annotated.zip
      try {
        await fs.access(configZipPath);

        const zipBuffer = await fs.readFile(configZipPath);
        const zip = await JSZip.loadAsync(zipBuffer);

        // First try to read annotation.json from config folder (saved separately by save-config)
        const configAnnotationJsonPath = path.join(generatorPath, "config", "annotation.json");
        try {
          const annotationData = await fs.readFile(configAnnotationJsonPath, "utf-8");
          annotation = JSON.parse(annotationData);
        } catch {
          // Fall back to extracting annotation.json from inside zip
          const annotationFile = zip.file("annotation.json");
          if (annotationFile) {
            const annotationData = await annotationFile.async("string");
            annotation = JSON.parse(annotationData);
          }
        }

        // Extract original image from zip
        const originalPng = zip.file("original.png");
        const originalJpg = zip.file("original.jpg");

        if (originalPng) {
          const imageBuffer = await originalPng.async("nodebuffer");
          const base64 = imageBuffer.toString("base64");
          imageDataUrl = `data:image/png;base64,${base64}`;
        } else if (originalJpg) {
          const imageBuffer = await originalJpg.async("nodebuffer");
          const base64 = imageBuffer.toString("base64");
          imageDataUrl = `data:image/jpeg;base64,${base64}`;
        }
      } catch {
        // No annotations found in either location
      }
    }

    if (!annotation) {
      return NextResponse.json(
        { error: `No annotations found for generator '${generatorName}'` },
        { status: 404 }
      );
    }

    // Ensure all icons have elementId (for backwards compatibility)
    const annotationWithIds = ensureIconElementIds(annotation);

    return NextResponse.json({
      annotation: annotationWithIds,
      imageDataUrl,
      generator: generatorName,
    });
  } catch (error) {
    console.error("Error loading from generator:", error);
    return NextResponse.json(
      { error: "Failed to load from generator" },
      { status: 500 }
    );
  }
}
