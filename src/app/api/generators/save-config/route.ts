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
    const annotationJson = formData.get("annotation") as string;

    if (!generatorName) {
      return NextResponse.json(
        { error: "Generator name is required" },
        { status: 400 }
      );
    }

    if (!zipFile || !annotationJson) {
      return NextResponse.json(
        { error: "ZIP file and annotation JSON are required" },
        { status: 400 }
      );
    }

    // Verify generator exists
    const generatorPath = path.join(GENERATORS_PATH, generatorName);
    const configPath = path.join(generatorPath, "config");

    try {
      await fs.access(configPath);
    } catch {
      return NextResponse.json(
        { error: `Generator '${generatorName}' config folder not found` },
        { status: 404 }
      );
    }

    // Save annotated.zip to config folder
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    const zipPath = path.join(configPath, "annotated.zip");
    await fs.writeFile(zipPath, zipBuffer);

    // Save annotation.json to config folder
    const configJsonPath = path.join(configPath, "annotation.json");
    await fs.writeFile(configJsonPath, annotationJson, "utf-8");

    // Extract ZIP and save all files to assets/annotations/
    const assetsAnnotationsPath = path.join(generatorPath, "assets", "annotations");
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(assetsAnnotationsPath, { recursive: true });

      // Extract ZIP contents
      const zip = await JSZip.loadAsync(zipBuffer);

      // Save each file from the ZIP
      const filePromises: Promise<void>[] = [];
      zip.forEach((relativePath, file) => {
        if (!file.dir) {
          const promise = file.async("nodebuffer").then(async (content) => {
            const filePath = path.join(assetsAnnotationsPath, relativePath);
            // Create parent directory if needed (for nested paths like icons/icon_1.png)
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, content);
          });
          filePromises.push(promise);
        }
      });

      await Promise.all(filePromises);

      // Also save annotation.json separately (it's in the ZIP but we have the latest version)
      const assetsJsonPath = path.join(assetsAnnotationsPath, "annotation.json");
      await fs.writeFile(assetsJsonPath, annotationJson, "utf-8");

      console.log("[SAVE-CONFIG] Extracted files to assets/annotations/");
    } catch (err) {
      console.error("[SAVE-CONFIG] Failed to extract to assets/annotations:", err);
    }

    const parsed = JSON.parse(annotationJson);
    console.log("[SAVE-CONFIG] Saved", parsed.elements?.length, "elements,", parsed.tasks?.length, "tasks");

    return NextResponse.json({
      success: true,
      generator: generatorName,
      path: configPath,
    });
  } catch (error) {
    console.error("Error saving to generator config:", error);
    return NextResponse.json(
      { error: "Failed to save to generator config" },
      { status: 500 }
    );
  }
}
