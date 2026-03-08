import { useState } from "react";
import AppSidebar, { type ViewType } from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import ChatView from "@/components/ChatView";
import WorkflowView from "@/components/WorkflowView";
import MemoryView from "@/components/MemoryView";
import TelemetryView from "@/components/TelemetryView";
import ResearchView from "@/components/ResearchView";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import PromptLibraryPanel from "@/components/PromptLibraryPanel";
import RAGPanel from "@/components/RAGPanel";

const Index = () => {
  const [activeView, setActiveView] = useState<ViewType>("chat");

  const viewLabels: Record<ViewType, string> = {
    chat: "Chat Interface",
    workflow: "Agent Workflow",
    memory: "Memory Inspector",
    telemetry: "System Telemetry",
    research: "Research & RAG",
    analytics: "Usage Analytics",
    prompts: "Prompt Library",
    rag: "Knowledge Base",
  };

  // For prompt library → navigate to chat with selected prompt
  const handlePromptSelect = (prompt: string) => {
    setActiveView("chat");
    // The prompt will be picked up via a simple approach - store in sessionStorage
    sessionStorage.setItem("echo_pending_prompt", prompt);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar viewLabel={viewLabels[activeView]} />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar activeView={activeView} onViewChange={setActiveView} />
        {activeView === "chat" && <ChatView />}
        {activeView === "workflow" && <WorkflowView />}
        {activeView === "memory" && <MemoryView />}
        {activeView === "telemetry" && <TelemetryView />}
        {activeView === "research" && <ResearchView />}
        {activeView === "analytics" && <AnalyticsDashboard />}
        {activeView === "prompts" && <PromptLibraryPanel onSelect={handlePromptSelect} />}
        {activeView === "rag" && <RAGPanel />}
      </div>
    </div>
  );
};

export default Index;
