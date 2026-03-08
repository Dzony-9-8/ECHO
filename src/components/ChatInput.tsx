import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, Paperclip, X, Image, FileText, Layers } from "lucide-react";
import {
  type FileAttachment,
  getFileType,
  getFilePreview,
  formatFileSize,
  isAcceptedFile,
  ACCEPT_STRING,
} from "@/lib/files";
import ModelSelector, { getSelectedModel } from "./ModelSelector";
import PromptTemplates from "./PromptTemplates";

interface Props {
  onSend: (message: string, files?: FileAttachment[], depth?: number, model?: string) => void;
  disabled?: boolean;
}

const ChatInput = ({ onSend, disabled }: Props) => {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [depth, setDepth] = useState(1);
  const [model, setModel] = useState(getSelectedModel);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: FileAttachment[] = [];
    for (const file of Array.from(fileList)) {
      if (!isAcceptedFile(file)) continue;
      if (file.size > 20 * 1024 * 1024) continue;
      const preview = await getFilePreview(file);
      newFiles.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        type: getFileType(file),
        preview,
        size: file.size,
      });
    }
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = () => {
    if ((!input.trim() && files.length === 0) || disabled) return;
    onSend(input.trim(), files.length > 0 ? files : undefined, depth, model);
    setInput("");
    setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTemplateSelect = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  useEffect(() => {
    const handleWindowDrag = (e: DragEvent) => { e.preventDefault(); };
    window.addEventListener("dragover", handleWindowDrag);
    window.addEventListener("drop", handleWindowDrag);
    return () => {
      window.removeEventListener("dragover", handleWindowDrag);
      window.removeEventListener("drop", handleWindowDrag);
    };
  }, []);

  return (
    <div
      ref={dropZoneRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`border-t border-border bg-card p-3 transition-colors relative ${
        isDragging ? "bg-primary/5 border-primary" : ""
      }`}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 border-2 border-dashed border-primary rounded pointer-events-none">
          <div className="text-center">
            <div className="flex items-center gap-3 mb-1">
              <Image className="w-5 h-5 text-terminal-magenta" />
              <FileText className="w-5 h-5 text-terminal-cyan" />
            </div>
            <p className="text-xs font-mono text-primary glow-green">
              Drop images or documents here
            </p>
          </div>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2 max-w-4xl mx-auto overflow-x-auto pb-1">
          {files.map((file) => (
            <div key={file.id} className="flex-shrink-0 relative group rounded border border-border bg-muted p-1.5">
              <button
                onClick={() => removeFile(file.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-terminal-red text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X className="w-2.5 h-2.5" />
              </button>
              {file.type === "image" && file.preview ? (
                <img src={file.preview} alt={file.name} className="w-16 h-16 object-cover rounded" />
              ) : (
                <div className="w-16 h-16 flex flex-col items-center justify-center gap-1">
                  <FileText className="w-5 h-5 text-terminal-cyan" />
                  <p className="text-[8px] text-terminal-cyan font-mono">RAG</p>
                </div>
              )}
              <p className="text-[8px] text-muted-foreground font-mono mt-1 truncate max-w-[64px]">{file.name}</p>
              <p className="text-[7px] text-muted-foreground/60 font-mono">{formatFileSize(file.size)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        {/* Prompt templates */}
        <PromptTemplates onSelect={handleTemplateSelect} />

        {/* File attach */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2.5 rounded border border-terminal-magenta bg-terminal-magenta/10 text-terminal-magenta hover:bg-terminal-magenta/20 transition-colors disabled:opacity-30"
          title="Attach files"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          className="hidden"
        />

        <div className="flex-1 relative">
          <div className="absolute left-3 top-3 text-primary text-sm glow-green select-none">{">"}_</div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={files.length > 0 ? "Describe what to do with these files..." : "Enter command... (drag files here)"}
            disabled={disabled}
            rows={1}
            className="w-full bg-input border border-border rounded px-3 py-2.5 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:glow-border resize-none font-mono disabled:opacity-50"
          />
        </div>

        {/* Model selector */}
        <ModelSelector value={model} onChange={setModel} />

        {/* Depth slider */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-border bg-muted/50" title="Critic iteration depth">
          <Layers className="w-3.5 h-3.5 text-terminal-red flex-shrink-0" />
          <input
            type="range"
            min={0}
            max={5}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-14 h-1 accent-terminal-red cursor-pointer"
          />
          <span className="text-[10px] font-mono text-terminal-red min-w-[14px] text-center">{depth}</span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={(!input.trim() && files.length === 0) || disabled}
          className="p-2.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
        <button
          className="p-2.5 rounded border border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan hover:bg-terminal-cyan/20 transition-colors opacity-50 cursor-not-allowed"
          title="Voice input (requires backend)"
        >
          <Mic className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
