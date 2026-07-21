import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Paperclip, X, FileText, Layers, Image as ImageIcon, Wand2, PhoneCall, Smile } from "lucide-react";
import {
  type FileAttachment,
  getFileType,
  getFilePreview,
  formatFileSize,
  isAcceptedFile,
  ACCEPT_STRING,
  getFileIcon,
} from "@/lib/files";
import { sendMessage, getBackendUrl } from "@/lib/api";
import ModelSelector, { getSelectedModel } from "./ModelSelector";
import PromptTemplates from "./PromptTemplates";
import SlashCommandMenu, { type SlashCommand } from "./SlashCommandMenu";
import EmojiPicker from "./EmojiPicker";
import EmojiAutocomplete from "./EmojiAutocomplete";
import { searchEmoji, type Emoji } from "@/lib/emoji";

interface Props {
  onSend: (message: string, files?: FileAttachment[], depth?: number, model?: string, images?: string[]) => void;
  disabled?: boolean;
}

interface ImagePreview {
  file: File;
  b64: string;
  url: string;
}

// Minimal shape of the Web Speech API result event (not in the TS DOM lib).
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

const ChatInput = ({ onSend, disabled }: Props) => {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [depth, setDepth] = useState(() => {
    const stored = Number(localStorage.getItem("echo_depth"));
    return stored >= 1 && stored <= 5 ? stored : 1;
  });
  const [model, setModel] = useState(getSelectedModel);

  // Persist depth so presets (and the next session) can restore it.
  useEffect(() => { localStorage.setItem("echo_depth", String(depth)); }, [depth]);
  const [isListening, setIsListening] = useState(false);
  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");   // active ":shortcode" query
  const [emojiStart, setEmojiStart] = useState(-1);   // index of the ":" in input
  const [isFixing, setIsFixing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Close the emoji picker on click outside its button+popup wrapper.
  useEffect(() => {
    if (!showEmoji) return;
    const onDown = (e: MouseEvent) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target as Node)) setShowEmoji(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showEmoji]);

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

    recognition.onresult = (event: SpeechResultEvent) => {
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

  const toggleIntercom = useCallback(async () => {
    if (isIntercomActive) {
      if (recognitionRef.current) recognitionRef.current.stop();
      socketRef.current?.close();
      setIsIntercomActive(false);
      return;
    }
    if (!speechSupported) {
        console.error("Transcriber needs WebKitSpeechRecognition support");
        return;
    }
    try {
      const wsUrl = getBackendUrl().replace("http", "ws") + "/api/voice/stream";
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setIsIntercomActive(true);
        // Using native VAD + STT layer instead of raw mic chunking
        const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        
        recognition.onresult = (event: any) => {
          let interim = "";
          let newFinal = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              newFinal += event.results[i][0].transcript + " ";
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          
          if (newFinal.trim().length > 0 && ws.readyState === WebSocket.OPEN) {
             ws.send(JSON.stringify({ text: newFinal.trim() }));
          }

          setInput((prev) => {
            const base = prev.replace(/\u200B.*$/, "").trimEnd();
            return (base ? base + " " : "") + newFinal + (interim ? "\u200B" + interim : "");
          });
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
           // Auto-restart if we haven't manually hung up!
           if (socketRef.current === ws) {
              try { recognition.start(); } catch (e) {}
           }
        };

        recognitionRef.current = recognition;
        recognition.start();
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          // Play TTS audio sent back by fish-speech via WebSocket
          if (data.type === "tts_audio" && data.audio_b64) {
            const raw = atob(data.audio_b64);
            const buf = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
            const blob = new Blob([buf], { type: "audio/wav" });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => URL.revokeObjectURL(url);
            audio.play().catch(() => {});
          }
        } catch {
          // non-JSON frame — ignore
        }
      };

      ws.onclose = () => {
        setIsIntercomActive(false);
        if (recognitionRef.current) recognitionRef.current.stop();
        setInput((prev) => prev.replace(/\u200B/g, ""));
      };
      
      socketRef.current = ws;
    } catch (e) {
      console.error("PersonaPlex Intercom failed", e);
    }
  }, [isIntercomActive, speechSupported]);

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

  // Detect an active ":shortcode" being typed before the caret.
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const caret = e.target.selectionStart ?? val.length;
    const m = val.slice(0, caret).match(/:([\w+-]{1,})$/);
    if (m) { setEmojiQuery(m[1]); setEmojiStart(caret - m[0].length); }
    else { setEmojiQuery(""); setEmojiStart(-1); }
  };

  const emojiAcVisible = emojiStart >= 0 && emojiQuery.length > 0 && searchEmoji(emojiQuery, 1).length > 0;

  // Insert an emoji at the caret (picker button).
  const insertEmoji = (char: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? input.length;
    const end = el?.selectionEnd ?? start;
    const next = input.slice(0, start) + char + input.slice(end);
    setInput(next);
    setShowEmoji(false);
    requestAnimationFrame(() => {
      const pos = start + char.length;
      el?.setSelectionRange(pos, pos);
      el?.focus();
    });
  };

  // Replace the typed ":shortcode" with the chosen emoji (autocomplete).
  const completeShortcode = (emoji: Emoji) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? input.length;
    const next = input.slice(0, emojiStart) + emoji.char + input.slice(caret);
    setInput(next);
    setEmojiQuery("");
    setEmojiStart(-1);
    requestAnimationFrame(() => {
      const pos = emojiStart + emoji.char.length;
      el?.setSelectionRange(pos, pos);
      el?.focus();
    });
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
    // Don't handle these keys when the slash or emoji menu is open (they handle their own)
    if ((showSlashMenu || emojiAcVisible) && (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
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

  const handleFixGrammar = useCallback(async () => {
    if (!input.trim() || isFixing) return;
    setIsFixing(true);
    try {
      const msgs = [{
        id: "fix",
        role: "user" as const,
        content: `Fix the grammar and spelling in the following text. Return only the corrected text with no explanation, no quotes, no commentary:\n\n${input}`,
        timestamp: new Date(),
      }];
      let result = "";
      await sendMessage(msgs, (chunk) => { result = chunk; }, 0, model);
      if (result.trim()) setInput(result.trim());
    } catch {
      // silently fail — input stays unchanged
    } finally {
      setIsFixing(false);
      textareaRef.current?.focus();
    }
  }, [input, isFixing, model]);

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

        {/* Fix grammar */}
        <button
          onClick={handleFixGrammar}
          disabled={disabled || !input.trim() || isFixing}
          className="p-2.5 rounded border border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan hover:bg-terminal-cyan/20 transition-colors disabled:opacity-30"
          title="Fix grammar & spelling with AI"
        >
          <Wand2 className={`w-4 h-4 ${isFixing ? "animate-pulse" : ""}`} />
        </button>

        {/* Emoji */}
        <div ref={emojiWrapRef} className="relative">
          <button
            onClick={() => setShowEmoji((s) => !s)}
            disabled={disabled}
            className="p-2.5 rounded border border-terminal-amber bg-terminal-amber/10 text-terminal-amber hover:bg-terminal-amber/20 transition-colors disabled:opacity-30"
            title="Insert emoji (or type :shortcode:)"
          >
            <Smile className="w-4 h-4" />
          </button>
          <EmojiPicker open={showEmoji} onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />
        </div>

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

          {/* Emoji :shortcode: autocomplete */}
          <EmojiAutocomplete
            query={emojiQuery}
            visible={emojiAcVisible}
            onSelect={completeShortcode}
            onClose={() => { setEmojiQuery(""); setEmojiStart(-1); }}
          />

          <div className="absolute left-3 top-3 text-primary text-sm glow-green select-none">{">"}_</div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={files.length > 0 ? "Describe what to do with these files..." : "Enter command or type / for commands..."}
            disabled={disabled}
            rows={1}
            spellCheck={true}
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
            disabled={disabled || isIntercomActive}
            className={`p-2.5 rounded border transition-colors ${
              isListening
                ? "border-terminal-red bg-terminal-red/20 text-terminal-red animate-pulse"
                : "border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan hover:bg-terminal-cyan/20"
            } disabled:opacity-30`}
            title={isListening ? "Stop listening" : "Voice dictation"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={toggleIntercom}
          disabled={disabled || isListening}
          className={`p-2.5 rounded border transition-all ${
            isIntercomActive
              ? "border-terminal-magenta bg-terminal-magenta/20 text-terminal-magenta animate-pulse shadow-[0_0_15px_rgba(255,0,255,0.4)]"
              : "border-terminal-magenta/50 bg-terminal-magenta/5 text-terminal-magenta hover:bg-terminal-magenta/20"
          } disabled:opacity-30`}
          title={isIntercomActive ? "End PersonaPlex Call" : "PersonaPlex Intercom Call"}
        >
          <PhoneCall className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
