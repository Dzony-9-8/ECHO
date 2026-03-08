export interface PresetPrompt {
  title: string;
  content: string;
  category: string;
  variables: string[];
}

export const PRESET_PROMPTS: PresetPrompt[] = [
  // Coding
  {
    title: "Code Review",
    content: "Review this {{language}} code for bugs, performance issues, and best practices. Suggest improvements with explanations:\n\n```{{language}}\n{{code}}\n```",
    category: "coding",
    variables: ["language", "code"],
  },
  {
    title: "Debug Error",
    content: "I'm getting this error in my {{language}} project:\n\n```\n{{error_message}}\n```\n\nHere's the relevant code:\n```{{language}}\n{{code}}\n```\n\nExplain the root cause and provide a fix.",
    category: "coding",
    variables: ["language", "error_message", "code"],
  },
  {
    title: "Write Unit Tests",
    content: "Write comprehensive unit tests for this {{language}} function using {{framework}}:\n\n```{{language}}\n{{code}}\n```\n\nInclude edge cases, error handling, and descriptive test names.",
    category: "coding",
    variables: ["language", "framework", "code"],
  },
  {
    title: "Refactor Code",
    content: "Refactor this {{language}} code to improve readability, maintainability, and performance. Apply SOLID principles where appropriate:\n\n```{{language}}\n{{code}}\n```",
    category: "coding",
    variables: ["language", "code"],
  },
  // Writing
  {
    title: "Professional Email",
    content: "Write a professional email about {{topic}} to {{recipient}}. Tone: {{tone}}. Key points to cover:\n\n{{key_points}}",
    category: "writing",
    variables: ["topic", "recipient", "tone", "key_points"],
  },
  {
    title: "Blog Post Outline",
    content: "Create a detailed blog post outline about {{topic}} targeting {{audience}}. Include:\n- Compelling title options\n- Introduction hook\n- 5-7 main sections with subpoints\n- Conclusion with CTA\n- SEO keywords to target",
    category: "writing",
    variables: ["topic", "audience"],
  },
  {
    title: "Documentation",
    content: "Write clear technical documentation for {{feature}}. Include:\n- Overview and purpose\n- Prerequisites\n- Step-by-step setup instructions\n- API reference (if applicable)\n- Examples\n- Troubleshooting common issues",
    category: "writing",
    variables: ["feature"],
  },
  // Research
  {
    title: "Compare Technologies",
    content: "Compare {{option_a}} vs {{option_b}} for {{use_case}}. Analyze:\n- Performance benchmarks\n- Developer experience\n- Ecosystem & community\n- Learning curve\n- Production readiness\n- Cost considerations\n\nProvide a recommendation with reasoning.",
    category: "research",
    variables: ["option_a", "option_b", "use_case"],
  },
  {
    title: "Architecture Review",
    content: "Review this system architecture for {{project_type}}:\n\n{{architecture_description}}\n\nAnalyze:\n- Scalability concerns\n- Single points of failure\n- Security considerations\n- Cost optimization opportunities\n- Alternative approaches",
    category: "research",
    variables: ["project_type", "architecture_description"],
  },
  // Analysis
  {
    title: "Data Analysis Plan",
    content: "Create a data analysis plan for {{dataset_description}}. Include:\n- Key questions to answer\n- Statistical methods to apply\n- Visualization recommendations\n- Potential insights to look for\n- Data quality checks needed",
    category: "analysis",
    variables: ["dataset_description"],
  },
  {
    title: "SWOT Analysis",
    content: "Perform a detailed SWOT analysis for {{subject}}:\n\n**Context:** {{context}}\n\nProvide specific, actionable insights for each quadrant with strategic recommendations.",
    category: "analysis",
    variables: ["subject", "context"],
  },
  // Creative
  {
    title: "Brainstorm Ideas",
    content: "Generate 10 creative ideas for {{topic}}. For each idea:\n- One-line pitch\n- Why it's compelling\n- Potential challenges\n- First step to implement\n\nConstraints: {{constraints}}",
    category: "creative",
    variables: ["topic", "constraints"],
  },
  // General
  {
    title: "Explain Concept",
    content: "Explain {{concept}} to someone with {{experience_level}} experience. Use:\n- Simple analogies\n- Real-world examples\n- Key terminology defined\n- Common misconceptions addressed\n- Resources for further learning",
    category: "general",
    variables: ["concept", "experience_level"],
  },
  {
    title: "Meeting Summary",
    content: "Summarize these meeting notes into a structured format:\n\n{{notes}}\n\nInclude:\n- Key decisions made\n- Action items with owners\n- Open questions\n- Next steps and deadlines",
    category: "general",
    variables: ["notes"],
  },
];
