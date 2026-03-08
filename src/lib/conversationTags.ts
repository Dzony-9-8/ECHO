export interface ConversationTag {
  id: string;
  label: string;
  color: string; // HSL string for the tag color
}

const STORAGE_KEY = "echo_conversation_tags";
const TAG_MAP_KEY = "echo_conversation_tag_map";

export const DEFAULT_TAGS: ConversationTag[] = [
  { id: "work", label: "Work", color: "210 70% 55%" },
  { id: "personal", label: "Personal", color: "142 70% 45%" },
  { id: "research", label: "Research", color: "280 60% 55%" },
  { id: "code", label: "Code", color: "185 60% 50%" },
  { id: "ideas", label: "Ideas", color: "38 90% 55%" },
  { id: "urgent", label: "Urgent", color: "0 70% 50%" },
];

export const getTags = (): ConversationTag[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_TAGS;
  } catch {
    return DEFAULT_TAGS;
  }
};

export const saveTags = (tags: ConversationTag[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
};

// Map: conversationId -> tagId[]
export const getTagMap = (): Record<string, string[]> => {
  try {
    const saved = localStorage.getItem(TAG_MAP_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const saveTagMap = (map: Record<string, string[]>) => {
  localStorage.setItem(TAG_MAP_KEY, JSON.stringify(map));
};

export const getTagsForConversation = (conversationId: string): string[] => {
  return getTagMap()[conversationId] || [];
};

export const setTagsForConversation = (conversationId: string, tagIds: string[]) => {
  const map = getTagMap();
  map[conversationId] = tagIds;
  saveTagMap(map);
};

export const toggleTagForConversation = (conversationId: string, tagId: string) => {
  const map = getTagMap();
  const current = map[conversationId] || [];
  if (current.includes(tagId)) {
    map[conversationId] = current.filter((t) => t !== tagId);
  } else {
    map[conversationId] = [...current, tagId];
  }
  saveTagMap(map);
  return map[conversationId];
};
