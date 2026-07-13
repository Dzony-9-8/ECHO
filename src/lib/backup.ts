// Full-app Backup / Restore — every echo_* localStorage key + the IndexedDB gallery
// in one portable JSON file. Generalizes the conversation-only Sessions export.

import { getAllImages, addImage, type StoredImage } from "./imageStore";

const PREFIX = "echo_";

interface FullBackup {
  app: "ECHO";
  version: 2;
  exportedAt: string;
  localStorage: Record<string, string>;
  gallery: StoredImage[];
}

/** All echo_* localStorage entries as raw string values. */
export const collectLocalStorage = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) out[k] = localStorage.getItem(k) ?? "";
  }
  return out;
};

export const backupCounts = async (): Promise<{ keys: number; images: number }> => {
  const keys = Object.keys(collectLocalStorage()).length;
  const images = await getAllImages().then((g) => g.length).catch(() => 0);
  return { keys, images };
};

/** Downloads a full backup and returns what it contained. */
export const exportAll = async (): Promise<{ keys: number; images: number }> => {
  const gallery = await getAllImages().catch(() => [] as StoredImage[]);
  const backup: FullBackup = {
    app: "ECHO",
    version: 2,
    exportedAt: new Date().toISOString(),
    localStorage: collectLocalStorage(),
    gallery,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `echo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return { keys: Object.keys(backup.localStorage).length, images: gallery.length };
};

/** Restores a full backup (overwrites matching keys, adds gallery images). */
export const importAll = async (file: File): Promise<{ keys: number; images: number }> => {
  const data = JSON.parse(await file.text());
  if (!data || data.app !== "ECHO" || typeof data.localStorage !== "object") {
    throw new Error("Not an ECHO backup file");
  }
  let keys = 0;
  for (const [k, v] of Object.entries(data.localStorage as Record<string, string>)) {
    if (k.startsWith(PREFIX) && typeof v === "string") { localStorage.setItem(k, v); keys++; }
  }
  let images = 0;
  if (Array.isArray(data.gallery)) {
    for (const img of data.gallery as StoredImage[]) {
      try { await addImage(img); images++; } catch { /* skip bad image */ }
    }
  }
  return { keys, images };
};
