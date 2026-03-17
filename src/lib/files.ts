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

/** Returns true for all files — no type restrictions */
export const isAcceptedFile = (_file: File): boolean => true;

/** Accept any file via the file picker */
export const ACCEPT_STRING = "*";

/** True for file types whose text content can be read and sent to the model */
const TEXT_MIME_PREFIXES = ["text/", "application/json", "application/javascript", "application/xml"];
const TEXT_EXTENSIONS = /\.(txt|md|csv|json|js|ts|jsx|tsx|py|java|c|cpp|h|cs|go|rs|rb|sh|yaml|yml|toml|ini|env|sql|html|htm|css|xml|svg|log|conf|cfg|gitignore|dockerfile)$/i;

export const isTextFile = (file: File): boolean => {
  if (TEXT_MIME_PREFIXES.some((p) => file.type.startsWith(p))) return true;
  return TEXT_EXTENSIONS.test(file.name);
};

/** Read a text file and return its content string */
export const readFileText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string ?? "");
    reader.onerror = reject;
    reader.readAsText(file);
  });

/** Return a short label/emoji for the file type to show in the UI */
export const getFileIcon = (file: File): string => {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type.startsWith("image/")) return "🖼";
  if (["pdf"].includes(ext)) return "📄";
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) return "📦";
  if (["mp4", "mov", "avi", "webm", "mkv"].includes(ext)) return "🎬";
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return "🎵";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["ppt", "pptx"].includes(ext)) return "📑";
  if (["py", "js", "ts", "jsx", "tsx", "go", "rs", "cpp", "c", "java", "cs"].includes(ext)) return "💻";
  if (["json", "yaml", "yml", "toml", "xml"].includes(ext)) return "⚙";
  return "📎";
};
