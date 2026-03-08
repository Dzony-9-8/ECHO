import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Document {
  id: string;
  title: string;
  content: string;
  file_name: string | null;
  file_type: string | null;
  category: string | null;
  created_at: string;
}

export const useDocuments = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("documents")
      .select("id, title, content, file_name, file_type, category, created_at")
      .order("created_at", { ascending: false });
    if (data) setDocuments(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const addDocument = useCallback(async (doc: { title: string; content: string; fileName?: string; fileType?: string; category?: string }) => {
    if (!user) return;
    await supabase.from("documents").insert({
      user_id: user.id,
      title: doc.title,
      content: doc.content,
      file_name: doc.fileName || null,
      file_type: doc.fileType || null,
      category: doc.category || "general",
    });
    load();
  }, [user, load]);

  const removeDocument = useCallback(async (id: string) => {
    await supabase.from("documents").delete().eq("id", id);
    load();
  }, [load]);

  const searchDocuments = useCallback(async (query: string): Promise<Document[]> => {
    if (!user || !query.trim()) return [];
    // Full-text search first
    const { data: ftsData } = await supabase
      .from("documents")
      .select("id, title, content, file_name, file_type, category, created_at")
      .textSearch("search_vector", query.split(" ").join(" & "))
      .limit(10);
    
    if (ftsData && ftsData.length > 0) return ftsData as Document[];

    // Fallback: ILIKE fuzzy search
    const { data: fuzzyData } = await supabase
      .from("documents")
      .select("id, title, content, file_name, file_type, category, created_at")
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(10);
    
    return (fuzzyData as Document[]) || [];
  }, [user]);

  const semanticSearch = useCallback(async (query: string): Promise<{ id: string; score: number; reason: string }[]> => {
    if (!user || !query.trim() || documents.length === 0) return [];
    try {
      const { data, error } = await supabase.functions.invoke("semantic-search", {
        body: {
          query,
          documents: documents.map((d) => ({ id: d.id, title: d.title, content: d.content })),
        },
      });
      if (error) throw error;
      return data?.results || [];
    } catch (err) {
      console.error("Semantic search failed:", err);
      return [];
    }
  }, [user, documents]);

  return { documents, loading, addDocument, removeDocument, searchDocuments, semanticSearch, refresh: load };
};
