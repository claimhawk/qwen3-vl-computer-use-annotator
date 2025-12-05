/**
 * GenerateButton - Trigger CUDAG generator project scaffolding from annotation
 *
 * This component provides a button to scaffold a complete CUDAG generator
 * project (Python code) from the current annotation. The workflow:
 * 1. Clip masked regions from the screenshot
 * 2. Send to Chandra (Modal) for OCR/transcription
 * 3. Analyze transcriptions to suggest data generators
 * 4. Scaffold the generator project with smart defaults
 */

import { useState, useEffect, useCallback } from "react";
import { UIElement, Task, Annotation } from "@/types/annotation";
import {
  checkServerHealth,
  generateProject,
  imageUrlToBase64,
  GenerateOptions,
  ServerHealth,
  clipMaskedRegions,
  transcribeRegions,
  analyzeTranscriptions,
  TranscriptionResult,
  GeneratorSuggestion,
} from "@/services";
import { addToleranceToElements } from "@/utils";

type GenerationStep = "idle" | "clipping" | "transcribing" | "analyzing" | "scaffolding" | "done";

interface GenerateButtonProps {
  screenName: string;
  imageSize: [number, number] | null;
  imagePath: string;
  imageUrl: string | null;
  elements: UIElement[];
  tasks: Task[];
  disabled?: boolean;
}

export function GenerateButton({
  screenName,
  imageSize,
  imagePath,
  imageUrl,
  elements,
  tasks,
  disabled = false,
}: GenerateButtonProps) {
  const [serverStatus, setServerStatus] = useState<ServerHealth | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<GenerationStep>("idle");
  const [transcriptionProgress, setTranscriptionProgress] = useState({ completed: 0, total: 0 });
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([]);
  const [suggestions, setSuggestions] = useState<GeneratorSuggestion[]>([]);

  // Options state
  const [projectName, setProjectName] = useState(screenName);

  // Sync project name with screen name
  useEffect(() => {
    setProjectName(screenName.replace(/\s+/g, "-").toLowerCase());
  }, [screenName]);

  // Check server health on mount and periodically
  useEffect(() => {
    const checkHealth = async () => {
      const health = await checkServerHealth();
      setServerStatus(health);
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!imageUrl || !imageSize) return;

    setIsGenerating(true);
    setError(null);
    setShowOptions(false);
    setTranscriptions([]);
    setSuggestions([]);

    try {
      let transcriptionResults: TranscriptionResult[] = [];
      let generatorSuggestions: GeneratorSuggestion[] = [];

      // Step 1: Clip masked regions from elements
      setCurrentStep("clipping");
      const clippedRegions = await clipMaskedRegions(imageUrl, elements);

      if (clippedRegions.length > 0) {
        // Step 2: Transcribe with Chandra OCR
        setCurrentStep("transcribing");
        setTranscriptionProgress({ completed: 0, total: clippedRegions.length });

        transcriptionResults = await transcribeRegions(
          clippedRegions,
          (completed, total) => setTranscriptionProgress({ completed, total })
        );
        setTranscriptions(transcriptionResults);

        // Step 3: Analyze transcriptions to suggest generators
        setCurrentStep("analyzing");
        generatorSuggestions = analyzeTranscriptions(transcriptionResults);
        setSuggestions(generatorSuggestions);
      }

      // Step 4: Scaffold generator project
      setCurrentStep("scaffolding");

      // Convert image to base64
      const originalImage = await imageUrlToBase64(imageUrl);

      // Build annotation object with transcription metadata
      const elementsWithTolerance = addToleranceToElements(elements);
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
      };

      // Scaffold generator project
      const options: GenerateOptions = {
        projectName,
      };

      const result = await generateProject(
        annotation,
        originalImage,
        undefined, // maskedImage
        undefined, // icons
        options
      );

      if (result.status === "error") {
        setError(result.error || "Generation failed");
        setIsGenerating(false);
        setCurrentStep("idle");
        return;
      }

      // Done!
      setCurrentStep("done");
      setIsGenerating(false);

      // Show results
      const transcriptionSummary = transcriptionResults.length > 0
        ? `\n\nTranscribed ${transcriptionResults.length} regions:\n${transcriptionResults
            .filter(t => t.text)
            .map(t => `  • ${t.dataType}: "${t.text.substring(0, 30)}${t.text.length > 30 ? '...' : ''}"`)
            .join('\n')}`
        : '';

      const suggestionSummary = generatorSuggestions.length > 0
        ? `\n\nSuggested generators:\n${generatorSuggestions
            .map(s => `  • ${s.generatorType}: ${s.description}`)
            .join('\n')}`
        : '';

      if (result.projectPath) {
        alert(
          `Generator project created at:\n${result.projectPath}` +
          transcriptionSummary +
          suggestionSummary +
          `\n\nNext steps:\n1. cd ${result.projectPath}\n2. Review and customize the generated code\n3. Run: python generator.py --samples 1000`
        );
      }

      setCurrentStep("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsGenerating(false);
      setCurrentStep("idle");
    }
  }, [
    imageUrl,
    imageSize,
    screenName,
    imagePath,
    elements,
    tasks,
    projectName,
  ]);

  const serverAvailable = serverStatus?.status === "healthy";
  const buttonDisabled = disabled || !serverAvailable || isGenerating || elements.length === 0;

  const getStepLabel = () => {
    switch (currentStep) {
      case "clipping": return "Clipping masked regions...";
      case "transcribing": return `Transcribing (${transcriptionProgress.completed}/${transcriptionProgress.total})...`;
      case "analyzing": return "Analyzing content types...";
      case "scaffolding": return "Creating project files...";
      case "done": return "Complete!";
      default: return "Processing...";
    }
  };

  return (
    <div className="relative">
      {/* Main button */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={buttonDisabled}
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          buttonDisabled
            ? "bg-zinc-600 cursor-not-allowed text-zinc-400"
            : "bg-purple-600 hover:bg-purple-700 text-white"
        }`}
      >
        {/* Server status indicator */}
        <span
          className={`w-2 h-2 rounded-full ${
            buttonDisabled
              ? "bg-zinc-500"
              : serverAvailable
              ? "bg-green-400"
              : "bg-red-400"
          }`}
          title={serverAvailable ? "Server connected" : "Server offline - run 'cudag serve'"}
        />
        {isGenerating ? "Generating..." : "Generate"}
      </button>

      {/* Options dropdown */}
      {showOptions && !isGenerating && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 p-4 z-50">
          <h3 className="text-sm font-semibold mb-3">Create Generator Project</h3>
          <p className="text-xs text-zinc-400 mb-3">
            Scaffold a CUDAG generator with screen, state, renderer, and task definitions.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm mt-1"
                placeholder="my-screen-generator"
              />
            </div>

            <p className="text-xs text-zinc-500">
              All masked regions will be transcribed with Chandra OCR
            </p>

            {error && (
              <div className="text-red-400 text-xs bg-red-900/20 px-2 py-1 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowOptions(false)}
                className="flex-1 px-3 py-1.5 rounded text-sm bg-zinc-700 hover:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!serverAvailable}
                className="flex-1 px-3 py-1.5 rounded text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-600 disabled:cursor-not-allowed font-medium"
              >
                Create Project
              </button>
            </div>
          </div>

          {!serverAvailable && (
            <p className="text-xs text-zinc-500 mt-3">
              Start the server with: <code className="bg-zinc-900 px-1 rounded">cudag serve</code>
            </p>
          )}
        </div>
      )}

      {/* Progress indicator */}
      {isGenerating && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 p-4 z-50">
          <h3 className="text-sm font-semibold mb-3">Creating Generator Project</h3>

          <div className="space-y-2">
            {/* Step indicators */}
            <div className="flex items-center gap-2 text-xs">
              <StepIndicator active={currentStep === "clipping"} done={["transcribing", "analyzing", "scaffolding", "done"].includes(currentStep)} />
              <span className={currentStep === "clipping" ? "text-white" : "text-zinc-500"}>Clip regions</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <StepIndicator active={currentStep === "transcribing"} done={["analyzing", "scaffolding", "done"].includes(currentStep)} />
              <span className={currentStep === "transcribing" ? "text-white" : "text-zinc-500"}>Transcribe with Chandra</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <StepIndicator active={currentStep === "analyzing"} done={["scaffolding", "done"].includes(currentStep)} />
              <span className={currentStep === "analyzing" ? "text-white" : "text-zinc-500"}>Analyze content types</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <StepIndicator active={currentStep === "scaffolding"} done={currentStep === "done"} />
              <span className={currentStep === "scaffolding" ? "text-white" : "text-zinc-500"}>Scaffold project</span>
            </div>

            <div className="pt-2 border-t border-zinc-700 mt-3">
              <p className="text-xs text-zinc-400">{getStepLabel()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ active, done }: { active: boolean; done: boolean }) {
  if (done) {
    return (
      <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (active) {
    return <span className="w-4 h-4 rounded-full bg-purple-500 animate-pulse" />;
  }
  return <span className="w-4 h-4 rounded-full bg-zinc-600" />;
}
