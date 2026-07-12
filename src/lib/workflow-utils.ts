export interface WorkflowAgent {
  name: string;
  enabled: boolean;
  systemPrompt: string;
  order: number;
  model?: string;
}

export interface WorkflowModelInfo {
  name: string;
  type: string;
  strengths: string[];
  estimated_vram_mb: number;
}

export const assignWorkflowModel = (role: string, models: WorkflowModelInfo[]): string | undefined => {
  if (!models || models.length === 0) return undefined;
  
  if (role === "Developer") {
    const codeModel = models.find(m => m.type === "code" || m.strengths.includes("code") || m.strengths.includes("programming"));
    if (codeModel) return codeModel.name;
  }
  
  if (role === "Critic" || role === "Planner" || role === "Researcher") {
    const reasoningModel = models.find(m => m.type === "reasoning" || m.strengths.includes("reasoning") || m.strengths.includes("analysis"));
    if (reasoningModel) return reasoningModel.name;
  }
  
  if (role === "Supervisor") {
    const generalModel = models.find(m => m.type === "general" || m.strengths.includes("general") || m.strengths.includes("conversation"));
    if (generalModel) return generalModel.name;
  }
  
  return models[0].name;
};

export const buildWorkflowAgentPayload = (
  agents: WorkflowAgent[],
  autoAssign: boolean,
  models: WorkflowModelInfo[]
) => {
  return agents.map(agent => {
    let assignedModel = agent.model;
    if (autoAssign) {
      const bestModel = assignWorkflowModel(agent.name, models);
      if (bestModel) {
        assignedModel = bestModel;
      }
    }
    return {
      name: agent.name,
      system_prompt: agent.systemPrompt,
      ...(assignedModel ? { model: assignedModel } : {})
    };
  });
};
