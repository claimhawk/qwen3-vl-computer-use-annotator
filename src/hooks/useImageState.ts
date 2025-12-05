/**
 * useImageState - Manages image loading and state
 *
 * This hook handles image loading, URL management, and image metadata.
 */

import { useState, useCallback } from "react";

export interface UseImageStateReturn {
  imageUrl: string | null;
  imageSize: [number, number] | null;
  imagePath: string;
  screenName: string;
  setScreenName: (name: string) => void;
  loadImageFile: (file: File) => Promise<void>;
  loadImageBlob: (blob: Blob, path?: string) => Promise<void>;
  setImageData: (url: string, size: [number, number], path: string) => void;
  clearImage: () => void;
  cropToRegion: (bbox: { x: number; y: number; width: number; height: number }) => Promise<void>;
}

export function useImageState(): UseImageStateReturn {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<[number, number] | null>(null);
  const [imagePath, setImagePath] = useState<string>("");
  const [screenName, setScreenName] = useState<string>("untitled_screen");

  const loadImageFile = useCallback(async (file: File): Promise<void> => {
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }

    setImagePath(file.name);
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
    setScreenName(baseName);

    const url = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        setImageSize([img.width, img.height]);
        setImageUrl(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  }, []);

  const loadImageBlob = useCallback(async (blob: Blob, path?: string): Promise<void> => {
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        setImageSize([img.width, img.height]);
        setImageUrl(url);
        if (path) {
          setImagePath(path);
        }
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  }, []);

  const setImageData = useCallback((url: string, size: [number, number], path: string) => {
    setImageUrl(url);
    setImageSize(size);
    setImagePath(path);
  }, []);

  const clearImage = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setImageSize(null);
    setImagePath("");
    setScreenName("untitled_screen");
  }, [imageUrl]);

  const cropToRegion = useCallback(async (bbox: { x: number; y: number; width: number; height: number }): Promise<void> => {
    if (!imageUrl || !imageSize) {
      throw new Error("No image loaded");
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = bbox.width;
        canvas.height = bbox.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(
          img,
          bbox.x, bbox.y, bbox.width, bbox.height,
          0, 0, bbox.width, bbox.height
        );

        const newImageUrl = canvas.toDataURL("image/png");
        setImageUrl(newImageUrl);
        setImageSize([bbox.width, bbox.height]);
        setScreenName((prev) => prev + "_cropped");
        resolve();
      };
      img.onerror = () => {
        reject(new Error("Failed to load image for cropping"));
      };
      img.src = imageUrl;
    });
  }, [imageUrl, imageSize]);

  return {
    imageUrl,
    imageSize,
    imagePath,
    screenName,
    setScreenName,
    loadImageFile,
    loadImageBlob,
    setImageData,
    clearImage,
    cropToRegion,
  };
}
