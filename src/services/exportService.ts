/**
 * Export Service
 *
 * Handles creating and loading annotation ZIP files.
 * Extracts the complex export logic from the main page component.
 */

import JSZip from "jszip";
import { UIElement, Annotation, Task, getElementColor } from "@/types/annotation";
import { getGridPositions, addToleranceToElements, MASKABLE_TYPES } from "@/utils";

export interface ExportOptions {
  screenName: string;
  imageSize: [number, number];
  imagePath: string;
  elements: UIElement[];
  tasks: Task[];
  dataTypes?: Record<string, { attributes: string[]; examples: Record<string, string>[] }>;
}

export interface LoadedAnnotation {
  annotation: Annotation;
  imageUrl: string;
}

export interface ClippedRegion {
  elementId: string;
  elementType: string;
  label?: string;
  imageBase64: string;
  bbox: { x: number; y: number; width: number; height: number };
  rows?: number;
  cols?: number;
}

/**
 * Create a ZIP file containing the annotation data and images.
 * If any elements have ocr: true, runs OCR and includes transcriptions.
 */
export async function createExportZip(
  imageUrl: string,
  options: ExportOptions,
  onProgress?: (step: string) => void
): Promise<Blob> {
  const { screenName, imageSize, imagePath, elements, tasks, dataTypes } = options;

  const zip = new JSZip();

  // Add tolerance values to elements
  // Note: OCR should be run separately via the OCR button before export
  // Elements already have transcription field populated
  const elementsWithTolerance = addToleranceToElements(elements);

  // 1. Add annotation JSON
  const annotation: Annotation = {
    screenName,
    imageSize,
    imagePath,
    elements: elementsWithTolerance,
    tasks,
    metadata: {
      sourceApp: "",
      screenType: "",
    },
    ...(dataTypes && Object.keys(dataTypes).length > 0 && { dataTypes }),
  };
  zip.file("annotation.json", JSON.stringify(annotation, null, 2));

  // Load the image
  const img = await loadImage(imageUrl);

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = imageSize[0];
  canvas.height = imageSize[1];
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // 2. Add original image
  ctx.drawImage(img, 0, 0);
  const originalBlob = await canvasToBlob(canvas, "image/png");
  if (originalBlob) {
    zip.file("original.png", originalBlob);
  }

  // 3. Add masked image
  await addMaskedImage(zip, ctx, img, imageSize, elements);

  // 4. Add annotated image
  await addAnnotatedImage(zip, ctx, img, imageSize, elements);

  // 5. Export icons
  await addExportedIcons(zip, img, elements);

  // 6. Export OCR regions for debugging
  await addOcrRegions(zip, img, elements);

  // 7. Export loading indicator images
  await addLoadingImages(zip, elements);

  return zip.generateAsync({ type: "blob" });
}

/**
 * Load an annotation from a ZIP file.
 */
export async function loadExportZip(file: File): Promise<LoadedAnnotation> {
  const zip = await JSZip.loadAsync(file);

  // Load annotation.json
  const annotationFile = zip.file("annotation.json");
  if (!annotationFile) {
    throw new Error("ZIP file does not contain annotation.json");
  }

  const annotationText = await annotationFile.async("string");
  const annotation: Annotation = JSON.parse(annotationText);

  // Load original.png
  const imageFile = zip.file("original.png");
  if (!imageFile) {
    throw new Error("ZIP file does not contain original.png");
  }

  const imageBlob = await imageFile.async("blob");
  const imageUrl = URL.createObjectURL(imageBlob);

  return { annotation, imageUrl };
}

/**
 * Load an annotation from a JSON file.
 */
export async function loadAnnotationJson(file: File): Promise<Annotation> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const annotation: Annotation = JSON.parse(event.target?.result as string);
        resolve(annotation);
      } catch (err) {
        reject(new Error("Failed to parse annotation JSON"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Clip masked regions from the original image for OCR/transcription.
 * Returns base64 encoded images for each maskable element.
 */
export async function clipMaskedRegions(
  imageUrl: string,
  elements: UIElement[]
): Promise<ClippedRegion[]> {
  const img = await loadImage(imageUrl);
  const regions: ClippedRegion[] = [];

  // Filter to maskable elements that have content to transcribe
  const maskableElements = elements.filter(
    (el) => (MASKABLE_TYPES as readonly string[]).includes(el.type)
  );

  for (const el of maskableElements) {
    const canvas = document.createElement("canvas");
    canvas.width = el.bbox.width;
    canvas.height = el.bbox.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    // Clip the region from the original image
    ctx.drawImage(
      img,
      el.bbox.x, el.bbox.y, el.bbox.width, el.bbox.height,
      0, 0, el.bbox.width, el.bbox.height
    );

    // Convert to base64
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");

    regions.push({
      elementId: el.id,
      elementType: el.type,
      label: el.text,
      imageBase64: base64,
      bbox: { ...el.bbox },
      rows: el.rows,
      cols: el.cols,
    });
  }

  return regions;
}

// Private helper functions

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type));
}

async function addMaskedImage(
  zip: JSZip,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  imageSize: [number, number],
  elements: UIElement[]
): Promise<void> {
  // Reset canvas to original
  ctx.drawImage(img, 0, 0);

  // Fill annotated regions with background color
  elements.forEach((el) => {
    // Skip if not maskable type or mask is explicitly disabled
    if (!(MASKABLE_TYPES as readonly string[]).includes(el.type)) return;
    if (el.mask === false) return;
    // Skip if no mask color set - require explicit sampling
    if (!el.maskColor) return;

    // Fill the region with sampled color
    ctx.fillStyle = el.maskColor;
    ctx.fillRect(el.bbox.x, el.bbox.y, el.bbox.width, el.bbox.height);
  });

  const maskedBlob = await canvasToBlob(ctx.canvas, "image/png");
  if (maskedBlob) {
    zip.file("masked.png", maskedBlob);
  }
}

async function addAnnotatedImage(
  zip: JSZip,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  imageSize: [number, number],
  elements: UIElement[]
): Promise<void> {
  // Reset and redraw original
  ctx.drawImage(img, 0, 0);

  // Draw elements on top
  elements.forEach((el) => {
    const color = getElementColor(el.type);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(el.bbox.x, el.bbox.y, el.bbox.width, el.bbox.height);

    // Label
    ctx.fillStyle = color;
    ctx.font = "12px sans-serif";
    const label = el.text ? `${el.type}: ${el.text}` : el.type;
    ctx.fillText(label, el.bbox.x + 2, el.bbox.y - 4);

    // Semi-transparent fill
    ctx.fillStyle = color + "30";
    ctx.fillRect(el.bbox.x, el.bbox.y, el.bbox.width, el.bbox.height);

    // Division lines
    const rows = el.rows || 1;
    const cols = el.cols || 1;
    if (rows > 1 || cols > 1) {
      const { colPositions, rowPositions } = getGridPositions(el);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (const rowY of rowPositions) {
        ctx.beginPath();
        ctx.moveTo(el.bbox.x, rowY);
        ctx.lineTo(el.bbox.x + el.bbox.width, rowY);
        ctx.stroke();
      }
      for (const colX of colPositions) {
        ctx.beginPath();
        ctx.moveTo(colX, el.bbox.y);
        ctx.lineTo(colX, el.bbox.y + el.bbox.height);
        ctx.stroke();
      }
    }
  });

  const annotatedBlob = await canvasToBlob(ctx.canvas, "image/png");
  if (annotatedBlob) {
    zip.file("annotated.png", annotatedBlob);
  }
}

async function addExportedIcons(
  zip: JSZip,
  img: HTMLImageElement,
  elements: UIElement[]
): Promise<void> {
  const exportableTypes = ["icon", "iconlist", "toolbar", "menubar"];
  const iconsToExport = elements.filter(
    (el) => exportableTypes.includes(el.type) && el.exportIcon
  );

  if (iconsToExport.length === 0) return;

  const iconsFolder = zip.folder("icons");
  if (!iconsFolder) return;

  for (const iconEl of iconsToExport) {
    const baseName = iconEl.text || iconEl.id;

    // Handle iconlist with icons array (new format)
    if ((iconEl.type === "iconlist" || iconEl.type === "toolbar" || iconEl.type === "menubar") && iconEl.icons && iconEl.icons.length > 0) {
      const iconWidth = iconEl.iconWidth ?? 32;
      const iconHeight = iconEl.iconHeight ?? 32;

      for (let idx = 0; idx < iconEl.icons.length; idx++) {
        const icon = iconEl.icons[idx];
        // Calculate absolute position from center
        const absX = iconEl.bbox.x + icon.centerX - iconWidth / 2;
        const absY = iconEl.bbox.y + icon.centerY - iconHeight / 2;

        const iconCanvas = document.createElement("canvas");
        iconCanvas.width = iconWidth;
        iconCanvas.height = iconHeight;
        const iconCtx = iconCanvas.getContext("2d");
        if (!iconCtx) continue;

        iconCtx.drawImage(
          img,
          absX, absY, iconWidth, iconHeight,
          0, 0, iconWidth, iconHeight
        );

        const iconName = icon.label || `icon_${idx + 1}`;
        const iconBlob = await canvasToBlob(iconCanvas, "image/png");
        if (iconBlob) {
          iconsFolder.file(`${baseName}_${iconName}.png`, iconBlob);
        }
      }
    } else {
      // Handle grid-based icons (legacy format)
      const rows = iconEl.rows || 1;
      const cols = iconEl.cols || 1;

      if (rows > 1 || cols > 1) {
        // Grid element - export individual cells
        const { colBounds, rowBounds } = getGridPositions(iconEl);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const srcX = colBounds[c];
            const srcY = rowBounds[r];
            const cellW = colBounds[c + 1] - colBounds[c];
            const cellH = rowBounds[r + 1] - rowBounds[r];

            const iconCanvas = document.createElement("canvas");
            iconCanvas.width = Math.round(cellW);
            iconCanvas.height = Math.round(cellH);
            const iconCtx = iconCanvas.getContext("2d");
            if (!iconCtx) continue;

            iconCtx.drawImage(
              img,
              srcX, srcY, cellW, cellH,
              0, 0, cellW, cellH
            );

            const idx = r * cols + c + 1;
            const iconBlob = await canvasToBlob(iconCanvas, "image/png");
            if (iconBlob) {
              iconsFolder.file(`${baseName}_${idx}.png`, iconBlob);
            }
          }
        }
      } else {
        // Single icon - export as-is
        const iconCanvas = document.createElement("canvas");
        iconCanvas.width = iconEl.bbox.width;
        iconCanvas.height = iconEl.bbox.height;
        const iconCtx = iconCanvas.getContext("2d");
        if (!iconCtx) continue;

        iconCtx.drawImage(
          img,
          iconEl.bbox.x, iconEl.bbox.y, iconEl.bbox.width, iconEl.bbox.height,
          0, 0, iconEl.bbox.width, iconEl.bbox.height
        );

        const iconBlob = await canvasToBlob(iconCanvas, "image/png");
        if (iconBlob) {
          iconsFolder.file(`${baseName}.png`, iconBlob);
        }
      }
    }
  }
}

async function addOcrRegions(
  zip: JSZip,
  img: HTMLImageElement,
  elements: UIElement[]
): Promise<void> {
  // Only export elements that have OCR checked
  const ocrElements = elements.filter((el) => el.ocr === true);

  if (ocrElements.length === 0) return;

  const ocrFolder = zip.folder("ocr_regions");
  if (!ocrFolder) return;

  for (const el of ocrElements) {
    const canvas = document.createElement("canvas");
    canvas.width = el.bbox.width;
    canvas.height = el.bbox.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    // Clip the region from the original image
    ctx.drawImage(
      img,
      el.bbox.x, el.bbox.y, el.bbox.width, el.bbox.height,
      0, 0, el.bbox.width, el.bbox.height
    );

    const blob = await canvasToBlob(canvas, "image/png");
    if (blob) {
      const name = el.text || el.id;
      ocrFolder.file(`${name}.png`, blob);
    }
  }
}

async function addLoadingImages(
  zip: JSZip,
  elements: UIElement[]
): Promise<void> {
  const loadingElements = elements.filter(
    (el) => el.type === "loading" && el.loadingImage
  );

  if (loadingElements.length === 0) return;

  const loadingFolder = zip.folder("loading");
  if (!loadingFolder) return;

  for (const el of loadingElements) {
    // Convert base64 data URL to blob
    const dataUrl = el.loadingImage!;
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const name = el.text || el.id;
    // Determine file extension from MIME type
    const ext = blob.type.includes("gif") ? "gif" : "png";
    loadingFolder.file(`${name}.${ext}`, blob);
  }
}
