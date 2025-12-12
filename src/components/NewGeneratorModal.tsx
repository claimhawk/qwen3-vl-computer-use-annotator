"use client";

import { useState, useRef, useEffect } from "react";

interface NewGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}

export default function NewGeneratorModal({
  isOpen,
  onClose,
  onCreated,
}: NewGeneratorModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Generator name is required");
      return;
    }

    // Validate name format (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmedName)) {
      setError(
        "Name must start with a letter and contain only letters, numbers, hyphens, and underscores"
      );
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/generators/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create generator");
        return;
      }

      onCreated(trimmedName);
      onClose();
    } catch (err) {
      setError("Failed to create generator");
      console.error("Create generator error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-zinc-900 rounded-lg w-[400px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-semibold">Create New Generator</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-4 py-4">
            <label className="block text-sm text-zinc-400 mb-2">
              Generator Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., my-generator"
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              disabled={isCreating}
            />
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
            <p className="text-zinc-500 text-xs mt-2">
              This will create a new folder in the generators directory with the required config structure.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-700">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
