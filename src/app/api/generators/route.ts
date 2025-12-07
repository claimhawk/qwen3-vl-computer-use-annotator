import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Path to generators directory (relative to the project root)
const GENERATORS_PATH = path.resolve(
  process.cwd(),
  "../generators"
);

// Folders to exclude from the generator list
const EXCLUDED_FOLDERS = new Set(["cudag", "workflow-generator", ".DS_Store"]);

export async function GET() {
  try {
    // Check if generators directory exists
    try {
      await fs.access(GENERATORS_PATH);
    } catch {
      return NextResponse.json(
        { error: "Generators directory not found", path: GENERATORS_PATH },
        { status: 404 }
      );
    }

    // Read directory contents
    const entries = await fs.readdir(GENERATORS_PATH, { withFileTypes: true });

    // Filter to only directories that are generators (have a config folder)
    const generators: { name: string; path: string; hasAnnotations: boolean }[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || EXCLUDED_FOLDERS.has(entry.name)) {
        continue;
      }

      const generatorPath = path.join(GENERATORS_PATH, entry.name);
      const configPath = path.join(generatorPath, "config");

      // Check if it has a config folder (indicates it's a generator)
      try {
        await fs.access(configPath);

        // Check if annotations exist in either location:
        // 1. assets/annotations/ folder (unpacked)
        // 2. config/annotated.zip (packed)
        const annotationsPath = path.join(generatorPath, "assets", "annotations");
        const configZipPath = path.join(configPath, "annotated.zip");
        let hasAnnotations = false;

        try {
          await fs.access(annotationsPath);
          hasAnnotations = true;
        } catch {
          // Check for config/annotated.zip as fallback
          try {
            await fs.access(configZipPath);
            hasAnnotations = true;
          } catch {
            // No annotations in either location
          }
        }

        generators.push({
          name: entry.name,
          path: generatorPath,
          hasAnnotations,
        });
      } catch {
        // Not a generator, skip
      }
    }

    // Sort alphabetically
    generators.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ generators });
  } catch (error) {
    console.error("Error listing generators:", error);
    return NextResponse.json(
      { error: "Failed to list generators" },
      { status: 500 }
    );
  }
}
