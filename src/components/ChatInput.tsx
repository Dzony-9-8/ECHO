import { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const ChatInput = ({ onSend, disabled }: Props) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-card p-3">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-3 text-primary text-sm glow-green select-none">
            {">"}_
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            disabled={disabled}
            rows={1}
            className="w-full bg-input border border-border rounded px-3 py-2.5 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:glow-border resize-none font-mono disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
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
