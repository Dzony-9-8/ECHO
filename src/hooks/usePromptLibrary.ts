import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PRESET_PROMPTS } from "@/lib/presetPrompts";

export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  category: string;
  is_favorite: boolean;
  variables: string[];
  created_at: string;
}

export const CATEGORIES = [
  "general",
  "coding",
  "research",
  "writing",
  "analysis",
  "creative",
] as const;

export const usePromptLibrary = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("prompt_templates")
      .select("*")
      .order("is_favorite", { ascending: false })
      .order("updated_at", { ascending: false });
    if (data) setTemplates(data as unknown as PromptTemplate[]);
    setLoading(false);
    return data;
  }, [user]);

  // Seed preset prompts on first use
  const seedPresets = useCallback(async () => {
    if (!user || seeded) return;
    const storageKey = `echo_presets_seeded_${user.id}`;
    if (localStorage.getItem(storageKey)) { setSeeded(true); return; }
    
    const data = await load();
    if (data && data.length === 0) {
      const inserts = PRESET_PROMPTS.map((p) => ({
        user_id: user.id,
        title: p.title,
        content: p.content,
        category: p.category,
        is_favorite: false,
        variables: p.variables,
      }));
      await supabase.from("prompt_templates").insert(inserts);
      await load();
    }
    localStorage.setItem(storageKey, "1");
    setSeeded(true);
  }, [user, seeded, load]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!loading) seedPresets(); }, [loading, seedPresets]);

  const create = useCallback(async (template: Omit<PromptTemplate, "id" | "created_at">) => {
    if (!user) return;
    await supabase.from("prompt_templates").insert({
      user_id: user.id,
      title: template.title,
      content: template.content,
      category: template.category,
      is_favorite: template.is_favorite,
      variables: template.variables,
    });
    load();
  }, [user, load]);

  const update = useCallback(async (id: string, updates: Partial<PromptTemplate>) => {
    await supabase.from("prompt_templates").update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("prompt_templates").delete().eq("id", id);
    load();
  }, [load]);

  const toggleFavorite = useCallback(async (id: string) => {
    const t = templates.find((t) => t.id === id);
    if (t) await update(id, { is_favorite: !t.is_favorite });
  }, [templates, update]);

  return { templates, loading, create, update, remove, toggleFavorite, refresh: load };
};
