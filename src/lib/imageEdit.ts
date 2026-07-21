// Client-side image editing via canvas — rotate, flip, and CSS-filter style
// adjustments. No backend, no fabrication: pixels in → pixels out, locally.

export interface Edits {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  brightness: number;  // %  (100 = original)
  contrast: number;    // %
  saturate: number;    // %
  grayscale: number;   // 0–100
  sepia: number;       // 0–100
}

export const DEFAULT_EDITS: Edits = {
  rotate: 0, flipH: false, flipV: false,
  brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0,
};

export const isDefault = (e: Edits): boolean =>
  e.rotate === 0 && !e.flipH && !e.flipV &&
  e.brightness === 100 && e.contrast === 100 && e.saturate === 100 &&
  e.grayscale === 0 && e.sepia === 0;

/** The CSS/canvas filter string for the current adjustments (shared by preview + render). */
export const filterString = (e: Edits): string =>
  `brightness(${e.brightness}%) contrast(${e.contrast}%) saturate(${e.saturate}%) grayscale(${e.grayscale}%) sepia(${e.sepia}%)`;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });

/**
 * Render the edited image to a PNG data URL. Rotation swaps canvas dimensions;
 * flips are applied via a mirrored transform; adjustments via ctx.filter.
 */
export const renderEdited = async (src: string, e: Edits): Promise<string> => {
  const img = await loadImage(src);
  const swap = e.rotate === 90 || e.rotate === 270;
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  ctx.filter = filterString(e);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((e.rotate * Math.PI) / 180);
  ctx.scale(e.flipH ? -1 : 1, e.flipV ? -1 : 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);

  return canvas.toDataURL("image/png");
};

/** CSS transform for a live <img> preview that mirrors renderEdited's geometry. */
export const previewTransform = (e: Edits): string =>
  `rotate(${e.rotate}deg) scaleX(${e.flipH ? -1 : 1}) scaleY(${e.flipV ? -1 : 1})`;
