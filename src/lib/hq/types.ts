// Rorop HQ - shared domain types for the work-management super app.
// These are plain data types shared by the server store, API routes and client pages.

export type VentureStatus = "idea" | "active" | "paused" | "done";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type TaskStatus = "todo" | "doing" | "done";
export type SourceKind = "manual" | "claude" | "secretary";
export type CommentTarget = "venture" | "task" | "knowledge";
export type CommentAuthor = "user" | "secretary";
export type KnowledgeKind = "conversation" | "project" | "note";

export const VENTURE_STATUSES: VentureStatus[] = ["idea", "active", "paused", "done"];
export const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];
export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done"];

export const VENTURE_STATUS_LABEL: Record<VentureStatus, string> = {
  idea: "아이디어",
  active: "진행 중",
  paused: "보류",
  done: "완료",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "대기",
  doing: "진행 중",
  done: "완료",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  P0: "긴급",
  P1: "높음",
  P2: "보통",
  P3: "낮음",
};

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Venture {
  id: string;
  user_id: string;
  name: string;
  summary: string;
  status: VentureStatus;
  priority: Priority;
  goal: string;
  tags: string[];
  source: SourceKind;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  venture_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  /** ISO date (YYYY-MM-DD) or null */
  due_date: string | null;
  checklist: ChecklistItem[];
  tags: string[];
  source: SourceKind;
  /** knowledge item id or secretary message id that produced this task */
  source_ref: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Comment {
  id: string;
  user_id: string;
  target_type: CommentTarget;
  target_id: string;
  author: CommentAuthor;
  body: string;
  created_at: string;
}

export interface AnalysisTask {
  title: string;
  description: string;
  priority: Priority;
  due_date: string | null;
}

export interface AnalysisResult {
  summary: string;
  venture: {
    name: string;
    summary: string;
    /** id of an existing venture this content belongs to, or null to create a new one */
    match_existing_id: string | null;
  };
  tasks: AnalysisTask[];
  insights: string[];
  analyzed_at: string;
}

export interface KnowledgeItem {
  id: string;
  user_id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  source_uuid: string | null;
  source_date: string | null;
  venture_id: string | null;
  summary: string;
  analyzed: boolean;
  analysis: AnalysisResult | null;
  created_at: string;
}

export interface Proposal {
  kind: "task";
  title: string;
  description: string;
  priority: Priority;
  due_date: string | null;
  venture_id: string | null;
  venture_name: string | null;
  accepted: boolean;
  /** id of the task that was created when the proposal was accepted */
  task_id: string | null;
}

export interface SecretaryMessage {
  id: string;
  user_id: string;
  role: "user" | "secretary";
  content: string;
  proposals: Proposal[];
  created_at: string;
}

export interface Briefing {
  id: string;
  user_id: string;
  /** YYYY-MM-DD in the user's local day */
  date: string;
  content: string;
  created_at: string;
}

// ---------- API response shapes (what the client pages consume) ----------

export interface VentureWithStats extends Venture {
  task_total: number;
  task_open: number;
  task_done: number;
}

export interface TaskWithVenture extends Task {
  venture_name: string | null;
}

export interface CommentWithTarget extends Comment {
  target_title: string;
}

export interface KnowledgeListItem extends Omit<KnowledgeItem, "content"> {
  content_length: number;
  venture_name: string | null;
  task_count: number;
}

export interface OverviewResponse {
  user: { id: string; name: string; email: string };
  today: string;
  ai_enabled: boolean;
  stats: {
    open_tasks: number;
    doing_tasks: number;
    overdue_tasks: number;
    done_this_week: number;
    ventures_active: number;
    ventures_total: number;
    knowledge_count: number;
    knowledge_unanalyzed: number;
  };
  tasks: {
    overdue: TaskWithVenture[];
    today: TaskWithVenture[];
    doing: TaskWithVenture[];
    upcoming: TaskWithVenture[];
    unscheduled_urgent: TaskWithVenture[];
  };
  ventures: VentureWithStats[];
  briefing: Briefing | null;
  recent_comments: CommentWithTarget[];
}

export interface StatusResponse {
  ai_enabled: boolean;
  model: string;
  hint: string | null;
}
