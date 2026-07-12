import { describe, expect, it } from "vitest";
import {
  getSelectableLocalModels,
  resolveLocalModelSelection,
  type ModelOption,
} from "@/components/ModelSelector";
import type { LocalModel } from "@/lib/api";

const model = (name: string, type = "general"): LocalModel => ({
  name,
  loaded: false,
  type,
  strengths: [type],
  estimated_vram_mb: 0,
});

describe("local model selection", () => {
  it("includes every installed chat-capable local model", () => {
    const options = getSelectableLocalModels([
      model("llama3.2:3b"),
      model("dolphin3:latest"),
      model("custom-uncensored:latest"),
      model("nomic-embed-text:latest", "embedding"),
    ]);

    expect(options.map((option) => option.id)).toEqual([
      "llama3.2:3b",
      "dolphin3:latest",
      "custom-uncensored:latest",
    ]);
  });

  it("auto-selects the first local model when the current value is cloud-only", () => {
    const options: ModelOption[] = [
      { id: "qwen2.5-coder:3b", label: "Qwen", description: "code", icon: "powerful" },
    ];

    expect(resolveLocalModelSelection("google/gemini-3-flash-preview", options)).toBe("qwen2.5-coder:3b");
  });

  it("auto-selects the first local model when the saved local model is no longer installed", () => {
    const options: ModelOption[] = [
      { id: "llama3.2:3b", label: "Llama", description: "general", icon: "fast" },
    ];

    expect(resolveLocalModelSelection("missing-local-model:latest", options)).toBe("llama3.2:3b");
  });

  it("keeps the current local model when it is installed", () => {
    const options: ModelOption[] = [
      { id: "llama3.2:3b", label: "Llama", description: "general", icon: "fast" },
    ];

    expect(resolveLocalModelSelection("llama3.2:3b", options)).toBeNull();
  });
});
