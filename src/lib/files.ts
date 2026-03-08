export interface FileAttachment {
  id: string;
  file: File;
  name: string;
  type: "image" | "document";
  preview?: string; // data URL for images
  size: number;
}

export const getFileType = (file: File): "image" | "document" => {
  if (file.type.startsWith("image/")) return "image";
  return "document";
};

export const getFilePreview = (file: File): Promise<string | undefined> => {
  if (!file.type.startsWith("image/")) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const ACCEPTED_TYPES = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  document: [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

export const isAcceptedFile = (file: File): boolean => {
  return [...ACCEPTED_TYPES.image, ...ACCEPTED_TYPES.document].includes(file.type);
};

export const ACCEPT_STRING = [
  ...ACCEPTED_TYPES.image,
  ...ACCEPTED_TYPES.document,
].join(",");
