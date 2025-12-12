import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Path to generators directory (relative to the project root)
const GENERATORS_PATH = path.resolve(process.cwd(), "../generators");

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Generator name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Validate name format
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmedName)) {
      return NextResponse.json(
        {
          error:
            "Name must start with a letter and contain only letters, numbers, hyphens, and underscores",
        },
        { status: 400 }
      );
    }

    const generatorPath = path.join(GENERATORS_PATH, trimmedName);

    // Check if generator already exists
    try {
      await fs.access(generatorPath);
      return NextResponse.json(
        { error: "A generator with this name already exists" },
        { status: 409 }
      );
    } catch {
      // Generator doesn't exist, proceed with creation
    }

    // Create generator directory structure
    await fs.mkdir(generatorPath, { recursive: true });
    await fs.mkdir(path.join(generatorPath, "config"), { recursive: true });
    await fs.mkdir(path.join(generatorPath, "assets"), { recursive: true });
    await fs.mkdir(path.join(generatorPath, "assets", "annotations"), {
      recursive: true,
    });

    return NextResponse.json({
      success: true,
      name: trimmedName,
      path: generatorPath,
    });
  } catch (error) {
    console.error("Error creating generator:", error);
    return NextResponse.json(
      { error: "Failed to create generator" },
      { status: 500 }
    );
  }
}
