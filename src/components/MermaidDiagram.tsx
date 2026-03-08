import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#2d9d5c",
    primaryTextColor: "#c0f0d0",
    primaryBorderColor: "#3ddc84",
    lineColor: "#3ddc84",
    secondaryColor: "#1a2a20",
    tertiaryColor: "#142018",
    background: "#0a0f0d",
    mainBkg: "#1a2a20",
    nodeBorder: "#3ddc84",
    clusterBkg: "#142018",
    titleColor: "#c0f0d0",
    edgeLabelBackground: "#0a0f0d",
  },
});

let mermaidCounter = 0;

const MermaidDiagram = ({ children }: { children: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const id = `mermaid-${++mermaidCounter}`;
    mermaid
      .render(id, children.trim())
      .then(({ svg }) => {
        setSvg(svg);
        setError("");
      })
      .catch(() => {
        setError("Invalid Mermaid diagram");
      });
  }, [children]);

  if (error) {
    return (
      <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs font-mono text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-2 overflow-x-auto rounded border border-border bg-muted/30 p-3 [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default MermaidDiagram;
