// Keyboard shortcuts — the reference data for the cheat-sheet overlay.
// Everything listed here is a shortcut that actually exists in the app.

export const SHORTCUTS_EVENT = "echo:show-shortcuts";

/** Open the cheat-sheet from anywhere (TopBar button, etc.). */
export const openShortcuts = () => window.dispatchEvent(new CustomEvent(SHORTCUTS_EVENT));

export interface Shortcut {
  keys: string[];   // rendered as <kbd> chips
  label: string;
}

export interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    items: [
      { keys: ["?"], label: "Show this cheat sheet" },
      { keys: ["Esc"], label: "Close menus, dialogs & the tour" },
    ],
  },
  {
    title: "Chat composer",
    items: [
      { keys: ["Enter"], label: "Send message" },
      { keys: ["Shift", "Enter"], label: "New line" },
      { keys: ["/"], label: "Slash-command menu (at line start)" },
      { keys: [":"], label: "Emoji :shortcode: autocomplete" },
      { keys: ["↑", "↓"], label: "Move through the slash / emoji menu" },
      { keys: ["Enter", "Tab"], label: "Accept the highlighted suggestion" },
    ],
  },
  {
    title: "Group chat",
    items: [
      { keys: ["Enter"], label: "Send to the group" },
      { keys: ["Shift", "Enter"], label: "New line" },
    ],
  },
  {
    title: "Onboarding tour",
    items: [
      { keys: ["→"], label: "Next step" },
      { keys: ["←"], label: "Previous step" },
      { keys: ["Esc"], label: "Skip the tour" },
    ],
  },
];
