import { useState, useEffect, lazy, Suspense } from "react";
import AppSidebar, { type ViewType } from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import ChatView from "@/components/ChatView";
import OnboardingTour from "@/components/OnboardingTour";
import ShortcutsCheatSheet from "@/components/ShortcutsCheatSheet";
import { tickReminders } from "@/lib/reminders";

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
const ModelCompareView = lazy(() => import("@/components/ModelCompareView"));
const ModelfileEditor = lazy(() => import("@/components/ModelfileEditor"));
const OdysseusUpdates = lazy(() => import("@/components/OdysseusUpdates"));
const PresetsView = lazy(() => import("@/components/PresetsView"));
const CookbookView = lazy(() => import("@/components/CookbookView"));
const NotesTasksView = lazy(() => import("@/components/NotesTasksView"));
const DocumentsView = lazy(() => import("@/components/DocumentsView"));
const GalleryView = lazy(() => import("@/components/GalleryView"));
const CalendarView = lazy(() => import("@/components/CalendarView"));
const ThemesView = lazy(() => import("@/components/ThemesView"));
const ContactsView = lazy(() => import("@/components/ContactsView"));
const DiagnosticsView = lazy(() => import("@/components/DiagnosticsView"));
const RemindersView = lazy(() => import("@/components/RemindersView"));
const GroupChatView = lazy(() => import("@/components/GroupChatView"));
const AboutMeView = lazy(() => import("@/components/AboutMeView"));
const ImageEditorView = lazy(() => import("@/components/ImageEditorView"));
const McpServersView = lazy(() => import("@/components/McpServersView"));

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
    compare: "Model Comparison",
    modelfile: "Modelfile Editor",
    odysseus: "Odysseus Updates",
    presets: "Presets & Commands",
    cookbook: "Cookbook",
    notes: "Notes & Tasks",
    documents: "Documents",
    gallery: "Gallery",
    calendar: "Calendar",
    themes: "Themes",
    contacts: "Contacts",
    diagnostics: "Diagnostics",
    reminders: "Reminders",
    groupchat: "Group Chat",
    aboutme: "About Me",
    imageeditor: "Image Editor",
    mcp: "MCP Servers",
  };

  // App-wide reminder engine — fires due reminders regardless of the active view.
  useEffect(() => {
    tickReminders();
    const id = setInterval(() => tickReminders(), 20000);
    return () => clearInterval(id);
  }, []);

  const handlePromptSelect = (prompt: string) => {
    setActiveView("chat");
    sessionStorage.setItem("echo_pending_prompt", prompt);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <OnboardingTour />
      <ShortcutsCheatSheet />
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
          {activeView === "compare" && <ModelCompareView />}
          {activeView === "modelfile" && <ModelfileEditor />}
          {activeView === "odysseus" && <OdysseusUpdates />}
          {activeView === "presets" && <PresetsView />}
          {activeView === "cookbook" && <CookbookView />}
          {activeView === "notes" && <NotesTasksView onSendToChat={handlePromptSelect} />}
          {activeView === "documents" && <DocumentsView />}
          {activeView === "gallery" && <GalleryView />}
          {activeView === "calendar" && <CalendarView />}
          {activeView === "themes" && <ThemesView />}
          {activeView === "contacts" && <ContactsView />}
          {activeView === "diagnostics" && <DiagnosticsView />}
          {activeView === "reminders" && <RemindersView />}
          {activeView === "groupchat" && <GroupChatView />}
          {activeView === "aboutme" && <AboutMeView />}
          {activeView === "imageeditor" && <ImageEditorView />}
          {activeView === "mcp" && <McpServersView />}
        </Suspense>
      </main>
    </div>
  );
};

export default Index;
