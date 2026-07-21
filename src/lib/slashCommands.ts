// Custom slash commands — user-defined /commands that expand into a prompt.
// Stored in localStorage and merged with the built-in commands in SlashCommandMenu.

export interface CustomSlashCommand {
  id: string;
  name: string;   // without the leading slash, e.g. "standup"
  prompt: string; // text inserted into the composer when chosen
}

const KEY = "echo_custom_slash";

/** Normalizes a raw name into a slash-command token: lowercase, no spaces/slashes. */
export const normalizeSlashName = (raw: string): string =>
  raw.trim().toLowerCase().replace(/^\/+/, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");

export const loadCustomSlash = (): CustomSlashCommand[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
};

export const saveCustomSlash = (cmds: CustomSlashCommand[]) => {
  localStorage.setItem(KEY, JSON.stringify(cmds));
};

export const upsertCustomSlash = (cmd: CustomSlashCommand): CustomSlashCommand[] => {
  const cmds = loadCustomSlash();
  const idx = cmds.findIndex((c) => c.id === cmd.id);
  if (idx >= 0) cmds[idx] = cmd;
  else cmds.push(cmd);
  saveCustomSlash(cmds);
  return cmds;
};

export const deleteCustomSlash = (id: string): CustomSlashCommand[] => {
  const cmds = loadCustomSlash().filter((c) => c.id !== id);
  saveCustomSlash(cmds);
  return cmds;
};
