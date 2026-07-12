import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon, Wand2, Loader2, Download, Trash2, AlertTriangle, CheckCircle2, X,
} from "lucide-react";
import { getBackendUrl } from "@/lib/api";
import { toast } from "sonner";
import {
  type StoredImage, addImage, getAllImages, deleteImage, newImageId,
} from "@/lib/imageStore";

interface StatusResponse {
  configured: boolean;
  model: string | null;
  base_url_set: boolean;
  api_key_set: boolean;
}

const SIZES = ["512x512", "768x768", "1024x1024", "1024x1792", "1792x1024"];

const GalleryView = () => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [lightbox, setLightbox] = useState<StoredImage | null>(null);

  const refreshGallery = useCallback(async () => {
    try { setImages(await getAllImages()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/images/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
    refreshGallery();
  }, [refreshGallery]);

  const generate = async () => {
    if (!prompt.trim()) { toast.error("Enter a prompt"); return; }
    setGenerating(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/images/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), size, n: 1 }),
      });
      const data = await res.json();
      if (data.error || !data.images?.length) {
        toast.error(data.error || "No image returned");
        return;
      }
      for (const b64 of data.images as string[]) {
        await addImage({
          id: newImageId(),
          prompt: prompt.trim(),
          size,
          dataUrl: `data:image/png;base64,${b64}`,
          createdAt: Date.now(),
        });
      }
      await refreshGallery();
      toast.success("Image generated");
    } catch {
      toast.error("Could not reach the backend");
    } finally {
      setGenerating(false);
    }
  };

  const download = (img: StoredImage) => {
    const a = document.createElement("a");
    a.href = img.dataUrl;
    a.download = `${img.prompt.replace(/[^\w-]+/g, "-").slice(0, 40) || "image"}.png`;
    a.click();
  };

  const remove = async (id: string) => {
    await deleteImage(id);
    await refreshGallery();
    if (lightbox?.id === id) setLightbox(null);
  };

  const configured = status?.configured;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card p-3 flex items-center gap-3 flex-wrap">
        <ImageIcon className="w-4 h-4 text-terminal-magenta" />
        <span className="text-xs font-mono text-terminal-magenta uppercase tracking-wider">Gallery</span>
        <span className="text-[10px] font-mono text-muted-foreground/60">AI image generation</span>
        <div className="flex-1" />
        {status && (
          <span className={`flex items-center gap-1 text-[9px] font-mono ${configured ? "text-primary" : "text-terminal-amber"}`}>
            {configured ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {configured ? `endpoint: ${status.model}` : "not configured"}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Not-configured setup notice — honest: ECHO ships no image model. */}
        {status && !configured && (
          <div className="flex items-start gap-2 p-3 rounded border border-terminal-amber/40 bg-terminal-amber/5 text-terminal-amber text-[10px] font-mono">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">Image generation is not configured.</div>
              <div className="text-terminal-amber/80">
                ECHO has no built-in image model. Point it at an OpenAI-compatible images endpoint by setting these on the backend and restarting:
              </div>
              <pre className="mt-1 text-[9px] bg-black/30 rounded p-2 whitespace-pre-wrap">{`IMAGE_API_URL=https://api.openai.com/v1   # or a local server, e.g. http://localhost:8080/v1
IMAGE_API_KEY=<your key>
IMAGE_MODEL=gpt-image-1                    # or your model`}</pre>
              <div className="text-terminal-amber/70">Works with OpenAI (gpt-image-1) or local OpenAI-compatible servers (LocalAI, Automatic1111 openai-compat, ComfyUI adapters).</div>
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="flex flex-wrap gap-2 items-end border border-border rounded bg-card p-3">
          <div className="flex-1 min-w-[240px]">
            <label className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">Prompt</label>
            <textarea
              aria-label="Image prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); generate(); } }}
              placeholder="A neon terminal glowing in a dark server room…"
              rows={2}
              className="w-full mt-1 bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-terminal-magenta resize-none"
            />
          </div>
          <select aria-label="Image size" value={size} onChange={(e) => setSize(e.target.value)}
            className="bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground focus:outline-none">
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={generate}
            disabled={generating || !prompt.trim() || (status != null && !configured)}
            className="flex items-center gap-1.5 px-4 py-2 rounded border border-terminal-magenta bg-terminal-magenta/10 text-terminal-magenta text-[11px] font-mono hover:bg-terminal-magenta/20 transition-all disabled:opacity-40"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>

        {/* Gallery grid */}
        {images.length === 0 ? (
          <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-12">
            No images yet. {configured ? "Generate one above." : "Configure an endpoint to start generating."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence>
              {images.map((img) => (
                <motion.div key={img.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative border border-border rounded overflow-hidden bg-card">
                  <button onClick={() => setLightbox(img)} className="block w-full aspect-square">
                    <img src={img.dataUrl} alt={img.prompt} className="w-full h-full object-cover" />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-[8px] font-mono text-white/80 line-clamp-2">{img.prompt}</div>
                  </div>
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => download(img)} aria-label="Download image"
                      className="p-1 rounded bg-black/60 text-white/80 hover:text-white"><Download className="w-3 h-3" /></button>
                    <button onClick={() => remove(img.id)} aria-label="Delete image"
                      className="p-1 rounded bg-black/60 text-white/80 hover:text-terminal-red"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => setLightbox(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="max-w-3xl max-h-[85vh] flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <img src={lightbox.dataUrl} alt={lightbox.prompt} className="max-h-[75vh] rounded border border-border object-contain" />
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[10px] font-mono text-white/70">{lightbox.prompt}</span>
                <button onClick={() => download(lightbox)} className="flex items-center gap-1 px-2.5 py-1 rounded border border-white/20 text-[10px] font-mono text-white/80 hover:bg-white/10">
                  <Download className="w-3 h-3" /> Download
                </button>
                <button onClick={() => setLightbox(null)} aria-label="Close" className="p-1 text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GalleryView;
