import { describe, expect, it } from "vitest";
import {
  assignWorkflowModel,
  buildWorkflowAgentPayload,
  type WorkflowAgent,
  type WorkflowModelInfo,
} from "../lib/workflow-utils";

const models: WorkflowModelInfo[] = [
  { name: "llama3.2:3b", type: "general", strengths: ["general", "conversation"], estimated_vram_mb: 2000 },
  { name: "qwen2.5-coder:3b", type: "code", strengths: ["code", "programming"], estimated_vram_mb: 2000 },
  { name: "qwen3:30b", type: "reasoning", strengths: ["reasoning", "analysis"], estimated_vram_mb: 18000 },
  { name: "nomic-embed-text:latest", type: "embedding", strengths: ["embedding"], estimated_vram_mb: 300 },
];

const agent = (name: string, model?: string): WorkflowAgent => ({
  name,
  enabled: true,
  systemPrompt: `${name} prompt`,
  order: 0,
  model,
});

describe("workflow model assignment", () => {
  it("assigns the best installed model for an agent role", () => {
    expect(assignWorkflowModel("Developer", models)).toBe("qwen2.5-coder:3b");
    expect(assignWorkflowModel("Critic", models)).toBe("qwen3:30b");
    expect(assignWorkflowModel("Supervisor", models)).toBe("llama3.2:3b");
  });

  it("builds workflow payload with auto-assigned models", () => {
    const payload = buildWorkflowAgentPayload([agent("Developer"), agent("Researcher")], true, models);

    expect(payload).toEqual([
      { name: "Developer", system_prompt: "Developer prompt", model: "qwen2.5-coder:3b" },
      { name: "Researcher", system_prompt: "Researcher prompt", model: "qwen3:30b" },
    ]);
  });

  it("preserves manual model choices when auto assignment is off", () => {
    const payload = buildWorkflowAgentPayload([agent("Developer", "llama3.2:3b")], false, models);

    expect(payload).toEqual([
      { name: "Developer", system_prompt: "Developer prompt", model: "llama3.2:3b" },
    ]);
  });
});
