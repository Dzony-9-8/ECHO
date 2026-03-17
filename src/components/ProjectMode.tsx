import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen,
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Star,
  Calendar,
  ListTodo,
} from "lucide-react";

const API_BASE = "http://localhost:8000";

interface Project {
  id: string;
  name: string;
  goal: string;
  context?: string;
  created_at: string;
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "done";
  created_at: string;
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const statusColor = (status: Task["status"]) => {
  if (status === "done") return "text-primary";
  if (status === "in_progress") return "text-terminal-amber";
  return "text-muted-foreground";
};

const StatusIcon = ({ status }: { status: Task["status"] }) => {
  if (status === "done")
    return <CheckCircle className="w-3.5 h-3.5 text-primary" style={{ filter: "drop-shadow(0 0 4px hsl(142 70% 45% / 0.7))" }} />;
  if (status === "in_progress")
    return <Circle className="w-3.5 h-3.5 text-terminal-amber animate-pulse" />;
  return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
};

// ─── New Project Form ──────────────────────────────────────────────────────────
const NewProjectForm = ({ onCreated }: { onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !goal.trim()) {
      setError("Name and goal are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), goal: goal.trim(), context: context.trim() }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setName("");
      setGoal("");
      setContext("");
      setOpen(false);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border rounded bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-primary hover:bg-muted/30 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="uppercase tracking-widest">New Project</span>
        {open ? (
          <ChevronDown className="w-3 h-3 ml-auto text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border p-3 space-y-2.5">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Project Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Agent Optimizer"
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Goal *
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What should this project accomplish?"
              rows={2}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Context (optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Background info, constraints, tech stack..."
              rows={2}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-terminal-red">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs font-mono border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded transition-all"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-mono border border-primary text-primary hover:bg-primary/10 rounded transition-all disabled:opacity-40 flex items-center gap-1.5"
              style={{ boxShadow: loading ? "none" : "0 0 8px hsl(142 70% 45% / 0.3)" }}
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Add Task Form ─────────────────────────────────────────────────────────────
const AddTaskForm = ({
  projectId,
  onAdded,
}: {
  projectId: string;
  onAdded: () => void;
}) => {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setTitle("");
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add task.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="New task title..."
          className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-terminal-cyan transition-colors"
        />
        <button
          onClick={submit}
          disabled={loading || !title.trim()}
          className="px-3 py-1.5 text-xs font-mono border border-terminal-cyan text-terminal-cyan hover:bg-terminal-cyan/10 rounded transition-all disabled:opacity-40 flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add
        </button>
      </div>
      {error && (
        <p className="text-[10px] font-mono text-terminal-red flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};

// ─── Project Detail Panel ─────────────────────────────────────────────────────
const ProjectDetail = ({
  project,
  isActive,
  onSetActive,
  onDelete,
  onRefresh,
}: {
  project: Project;
  isActive: boolean;
  onSetActive: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Project | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setDetail(data);
    } catch (e: unknown) {
      setDetailError(e instanceof Error ? e.message : "Failed to load project.");
    } finally {
      setLoadingDetail(false);
    }
  }, [project.id]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) loadDetail();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete project "${project.name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      onDelete(project.id);
    } catch {
      setDeleting(false);
    }
  };

  const taskCount = detail?.tasks?.length ?? project.tasks?.length ?? 0;
  const doneCount = (detail?.tasks ?? project.tasks ?? []).filter((t) => t.status === "done").length;

  return (
    <div
      className={`border rounded transition-all ${
        isActive
          ? "border-primary bg-card"
          : "border-border bg-card hover:border-border/80"
      }`}
      style={
        isActive
          ? { boxShadow: "0 0 12px hsl(142 70% 45% / 0.18), inset 0 0 0 1px hsl(142 70% 45% / 0.15)" }
          : {}
      }
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={handleExpand} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        <FolderOpen
          className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-terminal-cyan"}`}
          style={isActive ? { filter: "drop-shadow(0 0 5px hsl(142 70% 45% / 0.7))" } : {}}
        />

        <button
          onClick={handleExpand}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs font-mono truncate ${isActive ? "text-primary" : "text-foreground"}`}>
              {project.name}
            </span>
            {isActive && (
              <span className="text-[9px] font-mono text-primary border border-primary/40 px-1 py-0.5 rounded uppercase tracking-widest flex-shrink-0"
                style={{ boxShadow: "0 0 6px hsl(142 70% 45% / 0.3)" }}>
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {formatDate(project.created_at)}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <ListTodo className="w-2.5 h-2.5" />
              {taskCount} tasks
              {taskCount > 0 && (
                <span className="text-primary">({doneCount}/{taskCount})</span>
              )}
            </span>
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onSetActive(project.id)}
            title={isActive ? "Already active" : "Set as active project"}
            disabled={isActive}
            className={`p-1 rounded transition-all ${
              isActive
                ? "text-primary cursor-default"
                : "text-muted-foreground hover:text-terminal-amber hover:bg-terminal-amber/10"
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isActive ? "fill-primary" : ""}`} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete project"
            className="p-1 rounded text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10 transition-all"
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2.5 space-y-3">
          {/* Goal */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Goal</p>
            <p className="text-xs font-mono text-foreground/80 leading-relaxed">{project.goal}</p>
          </div>

          {/* Context */}
          {project.context && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Context</p>
              <p className="text-xs font-mono text-foreground/60 leading-relaxed">{project.context}</p>
            </div>
          )}

          {/* Tasks */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Tasks</p>

            {loadingDetail && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground animate-pulse py-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading tasks...
              </div>
            )}

            {detailError && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-terminal-red py-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                {detailError}
              </div>
            )}

            {!loadingDetail && !detailError && (
              <div className="space-y-1 mb-3">
                {(detail?.tasks ?? []).length === 0 ? (
                  <p className="text-[10px] font-mono text-muted-foreground/50 italic py-1">
                    No tasks yet. Add one below.
                  </p>
                ) : (
                  (detail?.tasks ?? []).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/20 transition-colors group"
                    >
                      <StatusIcon status={task.status} />
                      <span className={`text-xs font-mono flex-1 ${statusColor(task.status)}`}>
                        {task.title}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground/50 hidden group-hover:inline">
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            <AddTaskForm
              projectId={project.id}
              onAdded={() => {
                loadDetail();
                onRefresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const ProjectMode = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    () => localStorage.getItem("echo_active_project")
  );

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : data.projects ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleSetActive = (id: string) => {
    localStorage.setItem("echo_active_project", id);
    setActiveProjectId(id);
  };

  const handleDelete = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      localStorage.removeItem("echo_active_project");
      setActiveProjectId(null);
    }
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0"
        style={{ background: "linear-gradient(180deg, hsl(220 20% 6% / 0.97) 0%, hsl(220 20% 4% / 1) 100%)" }}>
        <FolderOpen className="w-4 h-4 text-terminal-cyan flex-shrink-0"
          style={{ filter: "drop-shadow(0 0 5px hsl(185 60% 50% / 0.7))" }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-mono text-terminal-cyan uppercase tracking-widest">Project Mode</h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            Manage long-running AI projects and task tracking
          </p>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground border border-border rounded px-2 py-1">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Active project banner */}
        {activeProject && (
          <div className="border border-primary/40 rounded p-3 bg-primary/5"
            style={{ boxShadow: "0 0 16px hsl(142 70% 45% / 0.12)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-3.5 h-3.5 text-primary fill-primary"
                style={{ filter: "drop-shadow(0 0 4px hsl(142 70% 45% / 0.8))" }} />
              <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Active Project</span>
            </div>
            <p className="text-sm font-mono text-foreground">{activeProject.name}</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5 line-clamp-1">{activeProject.goal}</p>
          </div>
        )}

        {/* New project form */}
        <NewProjectForm onCreated={loadProjects} />

        {/* Project list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Projects
            </span>
            <button
              onClick={loadProjects}
              className="text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors px-1.5"
            >
              Refresh
            </button>
          </div>

          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded h-14 bg-card animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="border border-terminal-red/30 rounded p-3 bg-terminal-red/5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-terminal-red flex-shrink-0" />
              <div>
                <p className="text-xs font-mono text-terminal-red">Failed to load projects</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{error}</p>
              </div>
              <button
                onClick={loadProjects}
                className="ml-auto text-[10px] font-mono text-terminal-red border border-terminal-red/40 hover:bg-terminal-red/10 px-2 py-1 rounded transition-all"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div className="border border-border rounded p-6 text-center space-y-2">
              <FolderOpen className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-xs font-mono text-muted-foreground">No projects yet.</p>
              <p className="text-[10px] font-mono text-muted-foreground/60">
                Create your first project above to get started.
              </p>
            </div>
          )}

          {!loading && !error && projects.map((project) => (
            <ProjectDetail
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              onSetActive={handleSetActive}
              onDelete={handleDelete}
              onRefresh={loadProjects}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectMode;
