import { useCallback, useEffect, useRef, useState } from "react";
import {
  ImageDown, Upload, RotateCw, RotateCcw, FlipHorizontal, FlipVertical,
  Save, Download, X, RefreshCw, Images,
} from "lucide-react";
import { toast } from "sonner";
import { type Edits, DEFAULT_EDITS, isDefault, filterString, previewTransform, renderEdited } from "@/lib/imageEdit";
import { type StoredImage, getAllImages, addImage, newImageId } from "@/lib/imageStore";

interface Slider { key: keyof Edits; label: string; min: number; max: number; }
const SLIDERS: Slider[] = [
  { key: "brightness", label: "Brightness", min: 0, max: 200 },
  { key: "contrast", label: "Contrast", min: 0, max: 200 },
  { key: "saturate", label: "Saturation", min: 0, max: 200 },
  { key: "grayscale", label: "Grayscale", min: 0, max: 100 },
  { key: "sepia", label: "Sepia", min: 0, max: 100 },
];

const ImageEditorView = () => {
  const [src, setSrc] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [edits, setEdits] = useState<Edits>(DEFAULT_EDITS);
  const [gallery, setGallery] = useState<StoredImage[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadGallery = useCallback(async () => {
    try { setGallery(await getAllImages()); } catch { setGallery([]); }
  }, []);
  useEffect(() => { loadGallery(); }, [loadGallery]);

  const openFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(reader.result as string);
      setSourceLabel(file.name);
      setEdits(DEFAULT_EDITS);
    };
    reader.readAsDataURL(file);
  };

  const pickFromGallery = (img: StoredImage) => {
    setSrc(img.dataUrl);
    setSourceLabel(img.prompt || "gallery image");
    setEdits(DEFAULT_EDITS);
    setShowGallery(false);
  };

  const rotateBy = (deg: 90 | -90) =>
    setEdits((e) => ({ ...e, rotate: (((e.rotate + deg) % 360) + 360) % 360 as Edits["rotate"] }));

  const setNum = (key: keyof Edits, value: number) => setEdits((e) => ({ ...e, [key]: value }));

  const saveToGallery = async () => {
    if (!src) return;
    setBusy(true);
    try {
      const dataUrl = await renderEdited(src, edits);
      await addImage({
        id: newImageId(),
        prompt: `Edited: ${sourceLabel}`.slice(0, 120),
        size: "edited",
        dataUrl,
        createdAt: Date.now(),
      });
      await loadGallery();
      toast.success("Saved edited copy to Gallery.");
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "render error"}`);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!src) return;
    setBusy(true);
    try {
      const dataUrl = await renderEdited(src, edits);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `echo-edit-${Date.now()}.png`;
      a.click();
    } catch (e) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : "render error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Controls */}
      <div className="w-64 flex-shrink-0 border-r border-border bg-sidebar/40 flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <ImageDown className="w-4 h-4 text-terminal-magenta" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground">Image Editor</span>
        </div>

        <div className="p-3 space-y-3">
          {/* Source */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Upload
            </button>
            <button
              onClick={() => { loadGallery(); setShowGallery(true); }}
              className="flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <Images className="w-3.5 h-3.5" /> Gallery
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) openFile(e.target.files[0]); e.target.value = ""; }} />

          {src && (
            <>
              {/* Transform */}
              <div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1.5">Transform</div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button onClick={() => rotateBy(-90)} title="Rotate left" className="p-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-terminal-cyan/50 flex items-center justify-center transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
                  <button onClick={() => rotateBy(90)} title="Rotate right" className="p-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-terminal-cyan/50 flex items-center justify-center transition-colors"><RotateCw className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEdits((e) => ({ ...e, flipH: !e.flipH }))} title="Flip horizontal" className={`p-2 rounded border flex items-center justify-center transition-colors ${edits.flipH ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}><FlipHorizontal className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEdits((e) => ({ ...e, flipV: !e.flipV }))} title="Flip vertical" className={`p-2 rounded border flex items-center justify-center transition-colors ${edits.flipV ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}><FlipVertical className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Adjustments */}
              <div className="space-y-2.5">
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">Adjustments</div>
                {SLIDERS.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="text-foreground">{edits[s.key] as number}</span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      value={edits[s.key] as number}
                      onChange={(e) => setNum(s.key, Number(e.target.value))}
                      className="w-full h-1 accent-terminal-magenta cursor-pointer"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={() => setEdits(DEFAULT_EDITS)}
                disabled={isDefault(edits)}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                <RefreshCw className="w-3 h-3" /> Reset edits
              </button>

              {/* Output */}
              <div className="pt-2 border-t border-border space-y-2">
                <button
                  onClick={saveToGallery}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-2 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" /> Save copy to Gallery
                </button>
                <button
                  onClick={download}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-2 rounded border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" /> Download PNG
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Canvas / preview */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-background/50">
        {src ? (
          <div className="max-w-full max-h-full flex flex-col items-center gap-3">
            <img
              src={src}
              alt="editing preview"
              className="max-w-full object-contain rounded border border-border"
              style={{ maxHeight: "70vh", filter: filterString(edits), transform: previewTransform(edits) }}
            />
            <p className="text-[10px] font-mono text-muted-foreground truncate max-w-md">{sourceLabel}</p>
          </div>
        ) : (
          <div className="text-center text-muted-foreground/50 font-mono text-xs">
            <ImageDown className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Upload an image or pick one from your Gallery to start editing.</p>
            <p className="mt-1 text-[10px]">All edits happen locally in your browser.</p>
          </div>
        )}
      </div>

      {/* Gallery picker */}
      {showGallery && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowGallery(false)} />
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display tracking-wide text-foreground">Pick from Gallery</h2>
              <button onClick={() => setShowGallery(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {gallery.length === 0 ? (
              <p className="text-[11px] font-mono text-muted-foreground/60 text-center py-8">
                Gallery is empty. Generate images in the Gallery view or upload a file instead.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {gallery.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => pickFromGallery(img)}
                    className="aspect-square rounded border border-border overflow-hidden hover:border-primary transition-colors"
                    title={img.prompt}
                  >
                    <img src={img.dataUrl} alt={img.prompt} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEditorView;
