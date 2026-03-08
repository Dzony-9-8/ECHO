import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";

interface Props {
  language?: string;
  children: string;
}

const CodeBlock = ({ language, children }: Props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded overflow-hidden border border-border my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/80 border-b border-border">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "12px",
          fontSize: "12px",
          lineHeight: 1.6,
          background: "hsl(var(--background))",
          border: "none",
          borderRadius: 0,
        }}
        wrapLongLines
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;
