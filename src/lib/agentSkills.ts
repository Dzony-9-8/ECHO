// Agent Skills System — localStorage-backed skill files per agent

export interface SkillEvalCase {
  id: string;
  prompt: string;
  expectedBehavior: string;
  lastResult?: "pass" | "fail";
  lastScore?: number; // 1-5
  lastNotes?: string;
  lastRunAt?: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  content: string;
  agent: string; // "Supervisor" | "Developer" | "Researcher" | "Critic" | "global"
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  source?: string; // e.g. "claude-code", "custom", filename
  evals?: SkillEvalCase[];
  triggerDescription?: string;
}

const STORAGE_KEY = "echo_agent_skills";

export const AGENT_NAMES = ["Supervisor", "Developer", "Researcher", "Critic"] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

// CRUD

export const getAllSkills = (): AgentSkill[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

export const getSkillsForAgent = (agent: string): AgentSkill[] => {
  return getAllSkills().filter(
    (s) => s.enabled && (s.agent === agent || s.agent === "global")
  );
};

export const saveSkill = (skill: Omit<AgentSkill, "id" | "createdAt" | "updatedAt">): AgentSkill => {
  const skills = getAllSkills();
  const now = new Date().toISOString();
  const newSkill: AgentSkill = {
    ...skill,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  skills.push(newSkill);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
  return newSkill;
};

export const updateSkill = (id: string, updates: Partial<AgentSkill>): void => {
  const skills = getAllSkills();
  const idx = skills.findIndex((s) => s.id === id);
  if (idx === -1) return;
  skills[idx] = { ...skills[idx], ...updates, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
};

export const deleteSkill = (id: string): void => {
  const skills = getAllSkills().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
};

// Build a combined skills prompt for a given agent
export const buildSkillsPrompt = (agent: string): string => {
  const skills = getSkillsForAgent(agent);
  if (skills.length === 0) return "";

  const sections = skills.map(
    (s) => `### Skill: ${s.name}\n${s.content}`
  );

  return `\n\n---\n## Agent Skills\nThe following skills are loaded for this agent:\n\n${sections.join("\n\n")}`;
};

// Parse a .md skill file — extracts title from first heading or filename
export const parseSkillFile = (
  content: string,
  fileName: string
): { name: string; content: string } => {
  const lines = content.split("\n");
  const headingLine = lines.find((l) => l.startsWith("# "));
  const name = headingLine
    ? headingLine.replace(/^#+\s*/, "").trim()
    : fileName.replace(/\.(md|txt)$/i, "");

  return { name, content };
};
