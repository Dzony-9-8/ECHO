const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, documents } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!query || !documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI to semantically rank documents by relevance
    const docSummaries = documents.map((d: { id: string; title: string; content: string }, i: number) => 
      `[${i}] "${d.title}": ${d.content.slice(0, 300)}`
    ).join("\n\n");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: "You are a document relevance ranker. Given a search query and documents, return a JSON array of objects with 'index' (document index) and 'score' (0-100 relevance score) and 'reason' (brief explanation). Only include documents with score > 20. Sort by score descending. Return ONLY valid JSON, no markdown."
            },
            {
              role: "user",
              content: `Query: "${query}"\n\nDocuments:\n${docSummaries}`
            }
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ results: [], error: "AI ranking failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse the AI response - handle potential markdown wrapping
    let rankings;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      rankings = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI ranking:", content);
      rankings = [];
    }

    // Map back to document IDs with scores
    const results = rankings
      .filter((r: { index: number; score: number }) => r.index >= 0 && r.index < documents.length)
      .map((r: { index: number; score: number; reason: string }) => ({
        id: documents[r.index].id,
        score: r.score,
        reason: r.reason,
      }));

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Semantic search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", results: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
