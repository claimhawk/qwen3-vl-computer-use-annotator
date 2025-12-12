import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

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

    // ALSO save to assets/annotations/annotation.json (this is where load reads from first!)
    const assetsAnnotationsPath = path.join(generatorPath, "assets", "annotations");
    try {
      await fs.access(assetsAnnotationsPath);
      const assetsJsonPath = path.join(assetsAnnotationsPath, "annotation.json");
      await fs.writeFile(assetsJsonPath, annotationJson, "utf-8");
      console.log("[SAVE-CONFIG] Wrote to assets/annotations/annotation.json");
    } catch {
      // assets/annotations folder doesn't exist, that's fine
    }

    const parsed = JSON.parse(annotationJson);
    console.log("[SAVE-CONFIG] Saved", parsed.elements?.length, "elements,", parsed.tasks?.length, "tasks");

    return NextResponse.json({
      success: true,
      generator: generatorName,
      files: ["annotated.zip", "annotation.json"],
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
