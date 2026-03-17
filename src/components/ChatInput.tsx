import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Paperclip, X, FileText, Layers, Image as ImageIcon } from "lucide-react";
import {
  type FileAttachment,
  getFileType,
  getFilePreview,
  formatFileSize,
  isAcceptedFile,
  ACCEPT_STRING,
  getFileIcon,
} from "@/lib/files";
import ModelSelector, { getSelectedModel } from "./ModelSelector";
import PromptTemplates from "./PromptTemplates";
import SlashCommandMenu, { type SlashCommand } from "./SlashCommandMenu";

interface Props {
  onSend: (message: string, files?: FileAttachment[], depth?: number, model?: string, images?: string[]) => void;
  disabled?: boolean;
}

interface ImagePreview {
  file: File;
  b64: string;
  url: string;
}

const ChatInput = ({ onSend, disabled }: Props) => {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [depth, setDepth] = useState(1);
  const [model, setModel] = useState(getSelectedModel);
  const [isListening, setIsListening] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const speechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleVoice = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    if (!speechSupported) return;

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim = transcript;
        }
      }
      setInput((prev) => {
        const base = prev.replace(/\u200B.*$/, "").trimEnd();
        const combined = (base ? base + " " : "") + finalTranscript + (interim ? "\u200B" + interim : "");
        return combined;
      });
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => {
      setIsListening(false);
      setInput((prev) => prev.replace(/\u200B/g, ""));
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, speechSupported]);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.trim()) {
        localStorage.setItem("echo_draft", input);
      } else {
        localStorage.removeItem("echo_draft");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [input]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem("echo_draft");
    if (draft && !input) setInput(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  // Show slash menu when input starts with /
  useEffect(() => {
    const trimmed = input.trimStart();
    if (trimmed.startsWith("/") && !trimmed.includes(" ")) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  }, [input]);

  const handleSlashSelect = (cmd: SlashCommand) => {
    setInput(cmd.prompt);
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  };

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

      // If image, also add to imagePreviews for vision sending
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          // Strip data URL prefix: "data:image/png;base64," -> just the base64 part
          const b64 = result.split(",")[1];
          setImagePreviews((prev) => [...prev, { file, b64, url: result }]);
        };
        reader.readAsDataURL(file);
      }
    }
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
  }, []);

  const removeFile = (id: string) => {
    const removing = files.find((f) => f.id === id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    // Also remove from imagePreviews if it was an image
    if (removing && removing.type === "image") {
      setImagePreviews((prev) => prev.filter((p) => p.file !== removing.file));
    }
  };

  const handleSubmit = () => {
    if ((!input.trim() && files.length === 0) || disabled) return;
    const imageB64s = imagePreviews.length > 0 ? imagePreviews.map((p) => p.b64) : undefined;
    onSend(input.trim(), files.length > 0 ? files : undefined, depth, model, imageB64s);
    setInput("");
    setFiles([]);
    setImagePreviews([]);
    setShowSlashMenu(false);
    localStorage.removeItem("echo_draft");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't handle Enter when slash menu is open (it handles its own)
    if (showSlashMenu && (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      return;
    }
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
            <div className="flex items-center gap-2 mb-1 text-2xl">
              <span>📎</span>
              <span>💻</span>
              <span>📄</span>
              <span>📦</span>
            </div>
            <p className="text-xs font-mono text-primary glow-green">
              Drop any file here
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
                  <span className="text-2xl leading-none">{getFileIcon(file.file)}</span>
                  <p className="text-[8px] text-terminal-cyan font-mono uppercase">{file.name.split(".").pop()?.slice(0, 4) ?? "file"}</p>
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
          title="Attach any file (images, code, docs, zips…)"
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
          {/* Slash command menu */}
          <SlashCommandMenu
            input={input.trimStart()}
            visible={showSlashMenu}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashMenu(false)}
          />

          <div className="absolute left-3 top-3 text-primary text-sm glow-green select-none">{">"}_</div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={files.length > 0 ? "Describe what to do with these files..." : "Enter command or type / for commands..."}
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
          disabled={(!input.trim() && files.length === 0 && imagePreviews.length === 0) || disabled}
          className="p-2.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
        {speechSupported && (
          <button
            onClick={toggleVoice}
            disabled={disabled}
            className={`p-2.5 rounded border transition-colors ${
              isListening
                ? "border-terminal-red bg-terminal-red/20 text-terminal-red animate-pulse"
                : "border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan hover:bg-terminal-cyan/20"
            } disabled:opacity-30`}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
