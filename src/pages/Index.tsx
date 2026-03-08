import { useState } from "react";
import AppSidebar, { type ViewType } from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import ChatView from "@/components/ChatView";
import WorkflowView from "@/components/WorkflowView";
import MemoryView from "@/components/MemoryView";
import TelemetryView from "@/components/TelemetryView";
import ResearchView from "@/components/ResearchView";

const Index = () => {
  const [activeView, setActiveView] = useState<ViewType>("chat");

  const viewLabels: Record<ViewType, string> = {
    chat: "Chat Interface",
    workflow: "Agent Workflow",
    memory: "Memory Inspector",
    telemetry: "System Telemetry",
    research: "Research & RAG",
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
      </div>
    </div>
  );
};

export default Index;
