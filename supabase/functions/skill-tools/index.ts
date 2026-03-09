const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SKILL_CREATOR_SYSTEM = `You are a Skill Creator for an AI agent system called ECHO. Your job is to author, tune, and upgrade agent skills.

A skill is a markdown document (SKILL.md) that contains instructions, patterns, and knowledge that gets injected into an agent's system prompt to enhance its capabilities.

When creating a new skill:
- Write clear, actionable instructions
- Include examples where helpful
- Structure with markdown headings
- Keep it focused on one capability
- Include a trigger description (when this skill should activate)

When tuning an existing skill:
- Analyze what works and what doesn't
- Suggest concrete improvements
- If the skill is unnecessary or harmful, recommend deletion with explanation

Format your output as a complete SKILL.md document starting with "# Skill: [Name]"`;

const EVAL_SYSTEM = `You are a Skill Evaluator for an AI agent system. Your job is to test whether a skill produces correct behavior.

You will receive:
1. A skill's content (the instructions that would be injected into an agent)
2. A test prompt
3. Expected behavior description

Your task:
- Simulate how an agent with this skill loaded would respond to the prompt
- Compare the likely response against the expected behavior
- Grade the result

You MUST call the grade_eval function with your assessment.`;

const TRIGGER_TUNING_SYSTEM = `You are a Skill Trigger Tuning expert. Your job is to analyze and refine skill trigger descriptions.

A trigger description determines WHEN a skill should be activated based on user prompts. Good triggers:
- Are specific enough to avoid false positives
- Are broad enough to catch all relevant prompts
- Use clear, pattern-matchable language

You will receive:
- Current skill name and description
- Sample prompts that SHOULD trigger the skill
- Sample prompts that should NOT trigger the skill

Analyze the current description and suggest an improved version. Call the suggest_trigger function with your analysis.`;

async function callAI(messages: any[], tools?: any[], toolChoice?: any, stream = false) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const body: any = {
    model: "google/gemini-3-flash-preview",
    messages,
    stream,
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");
    const t = await response.text();
    console.error("AI gateway error:", response.status, t);
    throw new Error("AI gateway error");
  }

  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mode, ...params } = await req.json();

    if (mode === "create") {
      const { description, existingSkill, agent } = params;
      const userPrompt = existingSkill
        ? `I have an existing skill that needs improvement:\n\n---\n${existingSkill}\n---\n\nHere's what I want to change/improve: ${description}\n\nTarget agent: ${agent || "Developer"}`
        : `Create a new skill based on this description: ${description}\n\nTarget agent: ${agent || "Developer"}`;

      const response = await callAI(
        [
          { role: "system", content: SKILL_CREATOR_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        undefined,
        undefined,
        true
      );

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    if (mode === "eval") {
      const { skillContent, prompt, expectedBehavior } = params;
      const userPrompt = `## Skill Content\n${skillContent}\n\n## Test Prompt\n${prompt}\n\n## Expected Behavior\n${expectedBehavior}`;

      const tools = [
        {
          type: "function",
          function: {
            name: "grade_eval",
            description: "Grade the eval result",
            parameters: {
              type: "object",
              properties: {
                pass: { type: "boolean", description: "Whether the skill produces the expected behavior" },
                score: { type: "number", description: "Score from 1-5 (5 = perfect match)" },
                notes: { type: "string", description: "Explanation of the grading" },
              },
              required: ["pass", "score", "notes"],
              additionalProperties: false,
            },
          },
        },
      ];

      const response = await callAI(
        [
          { role: "system", content: EVAL_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools,
        { type: "function", function: { name: "grade_eval" } }
      );

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const result = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ pass: false, score: 1, notes: "Failed to grade" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "tune-trigger") {
      const { skillName, currentDescription, shouldTrigger, shouldNotTrigger } = params;
      const userPrompt = `## Skill: ${skillName}\n\n## Current Description\n${currentDescription || "(none)"}\n\n## Should Trigger On\n${(shouldTrigger || []).map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}\n\n## Should NOT Trigger On\n${(shouldNotTrigger || []).map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}`;

      const tools = [
        {
          type: "function",
          function: {
            name: "suggest_trigger",
            description: "Suggest an improved trigger description",
            parameters: {
              type: "object",
              properties: {
                analysis: { type: "string", description: "Analysis of the current description" },
                suggestedDescription: { type: "string", description: "The improved trigger description" },
                predictedAccuracy: { type: "number", description: "Predicted accuracy percentage (0-100)" },
              },
              required: ["analysis", "suggestedDescription", "predictedAccuracy"],
              additionalProperties: false,
            },
          },
        },
      ];

      const response = await callAI(
        [
          { role: "system", content: TRIGGER_TUNING_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools,
        { type: "function", function: { name: "suggest_trigger" } }
      );

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const result = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ analysis: "Failed to analyze", suggestedDescription: "", predictedAccuracy: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "RATE_LIMIT" ? 429 : msg === "PAYMENT_REQUIRED" ? 402 : 500;
    const errorMsg =
      msg === "RATE_LIMIT" ? "Rate limit exceeded. Please try again in a moment." :
      msg === "PAYMENT_REQUIRED" ? "AI credits exhausted. Add credits in Settings → Workspace → Usage." :
      msg;
    return new Response(JSON.stringify({ error: errorMsg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
