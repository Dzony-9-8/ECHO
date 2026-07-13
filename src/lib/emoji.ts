// Curated emoji dataset for the composer picker + :shortcode: autocomplete.
// Compact tuple form: [char, shortcode, group]. Shortcodes are typed as ":shortcode:".

export type EmojiGroup =
  | "smileys" | "gestures" | "people" | "animals" | "food"
  | "activity" | "travel" | "objects" | "symbols";

export interface Emoji {
  char: string;
  code: string;   // shortcode without colons
  group: EmojiGroup;
}

const RAW: [string, string, EmojiGroup][] = [
  // Smileys & emotion
  ["😀", "grinning", "smileys"], ["😃", "smiley", "smileys"], ["😄", "smile", "smileys"],
  ["😁", "grin", "smileys"], ["😆", "laughing", "smileys"], ["😅", "sweat_smile", "smileys"],
  ["🤣", "rofl", "smileys"], ["😂", "joy", "smileys"], ["🙂", "slightly_smiling", "smileys"],
  ["😉", "wink", "smileys"], ["😊", "blush", "smileys"], ["😇", "innocent", "smileys"],
  ["🥰", "smiling_face_with_hearts", "smileys"], ["😍", "heart_eyes", "smileys"], ["😘", "kissing_heart", "smileys"],
  ["😜", "stuck_out_tongue_winking", "smileys"], ["🤪", "zany", "smileys"], ["🤨", "raised_eyebrow", "smileys"],
  ["🧐", "monocle", "smileys"], ["🤓", "nerd", "smileys"], ["😎", "sunglasses", "smileys"],
  ["🥳", "partying", "smileys"], ["😏", "smirk", "smileys"], ["😒", "unamused", "smileys"],
  ["😞", "disappointed", "smileys"], ["😔", "pensive", "smileys"], ["😟", "worried", "smileys"],
  ["😢", "cry", "smileys"], ["😭", "sob", "smileys"], ["😤", "triumph", "smileys"],
  ["😠", "angry", "smileys"], ["😡", "rage", "smileys"], ["🤯", "exploding_head", "smileys"],
  ["😳", "flushed", "smileys"], ["🥵", "hot_face", "smileys"], ["😱", "scream", "smileys"],
  ["😴", "sleeping", "smileys"], ["🤔", "thinking", "smileys"], ["🤗", "hugging", "smileys"],
  ["🤫", "shushing", "smileys"], ["🙄", "roll_eyes", "smileys"], ["😬", "grimacing", "smileys"],
  ["🥲", "smiling_tear", "smileys"], ["😷", "mask", "smileys"], ["🤒", "sick", "smileys"],
  ["💀", "skull", "smileys"], ["👻", "ghost", "smileys"], ["👽", "alien", "smileys"],
  ["🤖", "robot", "smileys"], ["💩", "poop", "smileys"], ["🤡", "clown", "smileys"],
  // Gestures & body
  ["👍", "thumbsup", "gestures"], ["👎", "thumbsdown", "gestures"], ["👌", "ok_hand", "gestures"],
  ["✌️", "victory", "gestures"], ["🤞", "crossed_fingers", "gestures"], ["🤟", "love_you", "gestures"],
  ["🤙", "call_me", "gestures"], ["👈", "point_left", "gestures"], ["👉", "point_right", "gestures"],
  ["👆", "point_up", "gestures"], ["👇", "point_down", "gestures"], ["☝️", "point_up_2", "gestures"],
  ["✋", "raised_hand", "gestures"], ["🖐️", "hand_splayed", "gestures"], ["🖖", "vulcan", "gestures"],
  ["👋", "wave", "gestures"], ["🤝", "handshake", "gestures"], ["🙏", "pray", "gestures"],
  ["✍️", "writing_hand", "gestures"], ["💪", "muscle", "gestures"], ["🙌", "raised_hands", "gestures"],
  ["👏", "clap", "gestures"], ["🤲", "palms_up", "gestures"], ["🫶", "heart_hands", "gestures"],
  ["👊", "fist", "gestures"], ["✊", "raised_fist", "gestures"], ["🤛", "fist_left", "gestures"],
  // People
  ["👀", "eyes", "people"], ["🧠", "brain", "people"], ["👶", "baby", "people"],
  ["🧑", "person", "people"], ["👨", "man", "people"], ["👩", "woman", "people"],
  ["🧑‍💻", "technologist", "people"], ["🕵️", "detective", "people"], ["🦸", "superhero", "people"],
  ["🧙", "mage", "people"], ["👑", "crown", "people"], ["🎅", "santa", "people"],
  // Animals & nature
  ["🐶", "dog", "animals"], ["🐱", "cat", "animals"], ["🐭", "mouse", "animals"],
  ["🐹", "hamster", "animals"], ["🐰", "rabbit", "animals"], ["🦊", "fox", "animals"],
  ["🐻", "bear", "animals"], ["🐼", "panda", "animals"], ["🐨", "koala", "animals"],
  ["🦁", "lion", "animals"], ["🐮", "cow", "animals"], ["🐷", "pig", "animals"],
  ["🐸", "frog", "animals"], ["🐵", "monkey", "animals"], ["🦄", "unicorn", "animals"],
  ["🐝", "bee", "animals"], ["🦋", "butterfly", "animals"], ["🐢", "turtle", "animals"],
  ["🐍", "snake", "animals"], ["🐙", "octopus", "animals"], ["🐳", "whale", "animals"],
  ["🌵", "cactus", "animals"], ["🌲", "evergreen", "animals"], ["🌸", "cherry_blossom", "animals"],
  ["🌚", "new_moon_face", "animals"], ["🌝", "full_moon_face", "animals"], ["⭐", "star", "animals"],
  ["🌟", "star2", "animals"], ["🔥", "fire", "animals"], ["💧", "droplet", "animals"],
  ["🌈", "rainbow", "animals"], ["⚡", "zap", "animals"], ["❄️", "snowflake", "animals"],
  // Food & drink
  ["🍎", "apple", "food"], ["🍌", "banana", "food"], ["🍕", "pizza", "food"],
  ["🍔", "hamburger", "food"], ["🍟", "fries", "food"], ["🌮", "taco", "food"],
  ["🍜", "ramen", "food"], ["🍣", "sushi", "food"], ["🍩", "doughnut", "food"],
  ["🍪", "cookie", "food"], ["🎂", "cake", "food"], ["🍰", "shortcake", "food"],
  ["🍫", "chocolate", "food"], ["🍿", "popcorn", "food"], ["☕", "coffee", "food"],
  ["🍵", "tea", "food"], ["🍺", "beer", "food"], ["🍷", "wine", "food"],
  ["🥂", "champagne", "food"], ["🧊", "ice_cube", "food"],
  // Activity
  ["⚽", "soccer", "activity"], ["🏀", "basketball", "activity"], ["🏈", "football", "activity"],
  ["🎾", "tennis", "activity"], ["🎮", "video_game", "activity"], ["🕹️", "joystick", "activity"],
  ["🎯", "dart", "activity"], ["🎲", "game_die", "activity"], ["🎸", "guitar", "activity"],
  ["🎹", "musical_keyboard", "activity"], ["🎤", "microphone", "activity"], ["🎧", "headphones", "activity"],
  ["🏆", "trophy", "activity"], ["🥇", "first_place", "activity"], ["🎉", "tada", "activity"],
  ["🎊", "confetti", "activity"], ["🎁", "gift", "activity"], ["🎨", "art", "activity"],
  // Travel & places
  ["🚀", "rocket", "travel"], ["✈️", "airplane", "travel"], ["🚗", "car", "travel"],
  ["🚕", "taxi", "travel"], ["🚌", "bus", "travel"], ["🚲", "bike", "travel"],
  ["🛸", "ufo", "travel"], ["🗺️", "map", "travel"], ["🏔️", "mountain", "travel"],
  ["🏝️", "island", "travel"], ["🏙️", "cityscape", "travel"], ["🌍", "earth", "travel"],
  // Objects
  ["💻", "computer", "objects"], ["🖥️", "desktop", "objects"], ["⌨️", "keyboard", "objects"],
  ["🖱️", "mouse_three_button", "objects"], ["📱", "iphone", "objects"], ["💾", "floppy_disk", "objects"],
  ["💿", "cd", "objects"], ["🔋", "battery", "objects"], ["🔌", "electric_plug", "objects"],
  ["💡", "bulb", "objects"], ["🔦", "flashlight", "objects"], ["📷", "camera", "objects"],
  ["🎥", "movie_camera", "objects"], ["📺", "tv", "objects"], ["📡", "satellite", "objects"],
  ["⏰", "alarm_clock", "objects"], ["⏳", "hourglass", "objects"], ["📅", "calendar", "objects"],
  ["📌", "pushpin", "objects"], ["📎", "paperclip", "objects"], ["🔒", "lock", "objects"],
  ["🔑", "key", "objects"], ["🔧", "wrench", "objects"], ["🔨", "hammer", "objects"],
  ["⚙️", "gear", "objects"], ["🧲", "magnet", "objects"], ["💰", "moneybag", "objects"],
  ["💎", "gem", "objects"], ["📦", "package", "objects"], ["📚", "books", "objects"],
  ["✏️", "pencil2", "objects"], ["📝", "memo", "objects"], ["🔍", "mag", "objects"],
  ["🗂️", "card_index_dividers", "objects"], ["📊", "bar_chart", "objects"], ["📈", "chart_up", "objects"],
  ["📉", "chart_down", "objects"], ["🧪", "test_tube", "objects"], ["🔬", "microscope", "objects"],
  // Symbols
  ["❤️", "heart", "symbols"], ["🧡", "orange_heart", "symbols"], ["💛", "yellow_heart", "symbols"],
  ["💚", "green_heart", "symbols"], ["💙", "blue_heart", "symbols"], ["💜", "purple_heart", "symbols"],
  ["🖤", "black_heart", "symbols"], ["🤍", "white_heart", "symbols"], ["💔", "broken_heart", "symbols"],
  ["💯", "100", "symbols"], ["✅", "white_check_mark", "symbols"], ["☑️", "ballot_box_with_check", "symbols"],
  ["✔️", "heavy_check_mark", "symbols"], ["❌", "x", "symbols"], ["❎", "negative_squared_cross_mark", "symbols"],
  ["⚠️", "warning", "symbols"], ["🚫", "no_entry_sign", "symbols"], ["❓", "question", "symbols"],
  ["❗", "exclamation", "symbols"], ["💤", "zzz", "symbols"], ["💬", "speech_balloon", "symbols"],
  ["💭", "thought_balloon", "symbols"], ["🔔", "bell", "symbols"], ["🔗", "link", "symbols"],
  ["♻️", "recycle", "symbols"], ["🆕", "new", "symbols"], ["🆗", "ok", "symbols"],
  ["🔴", "red_circle", "symbols"], ["🟢", "green_circle", "symbols"], ["🔵", "blue_circle", "symbols"],
];

export const EMOJIS: Emoji[] = RAW.map(([char, code, group]) => ({ char, code, group }));

export const EMOJI_GROUPS: { id: EmojiGroup; label: string }[] = [
  { id: "smileys", label: "Smileys" },
  { id: "gestures", label: "Gestures" },
  { id: "people", label: "People" },
  { id: "animals", label: "Nature" },
  { id: "food", label: "Food" },
  { id: "activity", label: "Activity" },
  { id: "travel", label: "Travel" },
  { id: "objects", label: "Objects" },
  { id: "symbols", label: "Symbols" },
];

/** Emoji whose shortcode contains the query — for :shortcode: autocomplete. */
export const searchEmoji = (query: string, limit = 8): Emoji[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = EMOJIS.filter((e) => e.code.startsWith(q));
  const contains = EMOJIS.filter((e) => !e.code.startsWith(q) && e.code.includes(q));
  return [...starts, ...contains].slice(0, limit);
};
