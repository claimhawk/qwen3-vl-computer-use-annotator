import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";

// Path to generators directory
const GENERATORS_PATH = path.resolve(process.cwd(), "../generators");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const generatorName = formData.get("generator") as string;
    const zipFile = formData.get("zip") as File;

    if (!generatorName) {
      return NextResponse.json(
        { error: "Generator name is required" },
        { status: 400 }
      );
    }

    if (!zipFile) {
      return NextResponse.json(
        { error: "ZIP file is required" },
        { status: 400 }
      );
    }

    // Verify generator exists
    const generatorPath = path.join(GENERATORS_PATH, generatorName);
    try {
      await fs.access(generatorPath);
    } catch {
      return NextResponse.json(
        { error: `Generator '${generatorName}' not found` },
        { status: 404 }
      );
    }

    // Create assets/annotations folder if it doesn't exist
    const annotationsPath = path.join(generatorPath, "assets", "annotations");
    await fs.mkdir(annotationsPath, { recursive: true });

    // Read and extract the ZIP file
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    const zip = await JSZip.loadAsync(zipBuffer);

    // Extract each file from the ZIP
    const extractedFiles: string[] = [];
    for (const [filename, file] of Object.entries(zip.files)) {
      if (file.dir) continue;

      const content = await file.async("nodebuffer");
      const filePath = path.join(annotationsPath, filename);

      // Create subdirectories if needed (for ocr_regions/, icons/, etc.)
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });

      await fs.writeFile(filePath, content);
      extractedFiles.push(filename);
    }

    // Also save the original ZIP for reference
    const zipPath = path.join(annotationsPath, "export.zip");
    await fs.writeFile(zipPath, zipBuffer);

    return NextResponse.json({
      success: true,
      generator: generatorName,
      path: annotationsPath,
      files: extractedFiles,
    });
  } catch (error) {
    console.error("Error saving to generator:", error);
    return NextResponse.json(
      { error: "Failed to save to generator" },
      { status: 500 }
    );
  }
}
