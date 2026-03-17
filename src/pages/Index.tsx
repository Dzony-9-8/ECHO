import { useState, lazy, Suspense } from "react";
import AppSidebar, { type ViewType } from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import ChatView from "@/components/ChatView";

const WorkflowView = lazy(() => import("@/components/WorkflowView"));
const MemoryView = lazy(() => import("@/components/MemoryView"));
const TelemetryView = lazy(() => import("@/components/TelemetryView"));
const ResearchView = lazy(() => import("@/components/ResearchView"));
const AnalyticsDashboard = lazy(() => import("@/components/AnalyticsDashboard"));
const PromptLibraryPanel = lazy(() => import("@/components/PromptLibraryPanel"));
const RAGPanel = lazy(() => import("@/components/RAGPanel"));
const AgentSkillsPanel = lazy(() => import("@/components/AgentSkillsPanel"));
const WorkflowBuilder = lazy(() => import("@/components/WorkflowBuilder"));
const ToolsPanel = lazy(() => import("@/components/ToolsPanel"));
const PluginManager = lazy(() => import("@/components/PluginManager"));
const AutonomousMode = lazy(() => import("@/components/AutonomousMode"));
const ProjectMode = lazy(() => import("@/components/ProjectMode"));

const LazyFallback = () => (
  <div className="flex-1 flex items-center justify-center">
    <span className="text-xs font-mono text-primary animate-pulse">Loading module...</span>
  </div>
);

const Index = () => {
  const [activeView, setActiveView] = useState<ViewType>("chat");

  const viewLabels: Record<ViewType, string> = {
    chat: "Chat Interface",
    workflow: "Agent Workflow",
    builder: "Workflow Builder",
    memory: "Memory Inspector",
    telemetry: "System Telemetry",
    research: "Research & RAG",
    analytics: "Usage Analytics",
    prompts: "Prompt Library",
    rag: "Knowledge Base",
    skills: "Agent Skills",
    tools: "Tool Execution",
    plugins: "Plugin Manager",
    autonomous: "Autonomous Mode",
    project: "Project Mode",
  };

  const handlePromptSelect = (prompt: string) => {
    setActiveView("chat");
    sessionStorage.setItem("echo_pending_prompt", prompt);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar viewLabel={viewLabels[activeView]} />
      <main className="flex-1 flex overflow-hidden">
        <AppSidebar activeView={activeView} onViewChange={setActiveView} />
        {activeView === "chat" && <ChatView />}
        <Suspense fallback={<LazyFallback />}>
          {activeView === "workflow" && <WorkflowView />}
          {activeView === "builder" && <WorkflowBuilder />}
          {activeView === "memory" && <MemoryView />}
          {activeView === "telemetry" && <TelemetryView />}
          {activeView === "research" && <ResearchView />}
          {activeView === "analytics" && <AnalyticsDashboard />}
          {activeView === "prompts" && <PromptLibraryPanel onSelect={handlePromptSelect} />}
          {activeView === "rag" && <RAGPanel />}
          {activeView === "skills" && <AgentSkillsPanel />}
          {activeView === "tools" && <ToolsPanel />}
          {activeView === "plugins" && <PluginManager />}
          {activeView === "autonomous" && <AutonomousMode />}
          {activeView === "project" && <ProjectMode />}
        </Suspense>
      </main>
    </div>
  );
};

export default Index;
