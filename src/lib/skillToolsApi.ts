import { getBackendMode, getBackendUrl } from "@/lib/api";

/**
 * Call the skill-tools endpoint, routing to local backend or cloud based on mode.
 * Returns the raw Response for the caller to handle (SSE stream or JSON).
 */
export async function callSkillTools(body: Record<string, unknown>): Promise<Response> {
  const mode = getBackendMode();

  if (mode === "local") {
    const url = getBackendUrl();
    return fetch(`${url}/api/skill-tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // Cloud mode: call Supabase edge function
  return fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/skill-tools`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    }
  );
}
