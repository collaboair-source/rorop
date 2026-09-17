// File-backed JSON store.
//
// The MVP started as a pure in-memory store. Rorop HQ needs data to survive
// server restarts (and Next.js dev hot reloads), so the whole store is now
// persisted to a single JSON file with atomic writes. Call `persist()` after
// every mutation. The store object is cached on `globalThis` so hot reloads in
// development keep a single instance.

import fs from "fs";
import path from "path";
import type {
  Venture,
  Task,
  Comment,
  KnowledgeItem,
  SecretaryMessage,
  Briefing,
} from "./hq/types";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: "client" | "designer";
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  client_id: string;
  designer_id: string;
  revision_limit: number;
  revision_used: number;
  status: "active" | "completed" | "over_limit";
  created_at: string;
}

export interface Feedback {
  id: string;
  project_id: string;
  user_id: string;
  style: "luxury" | "minimal" | "trendy" | "bold" | null;
  color: "bright" | "dark" | "warm" | "cool" | null;
  focus: "text" | "image" | "brand" | null;
  comment: string;
  created_at: string;
}

export interface DesignVersion {
  id: string;
  project_id: string;
  version_number: number;
  image_url: string;
  label: string;
  notes: string;
  created_at: string;
}

export interface Selection {
  id: string;
  project_id: string;
  selected_version_id: string;
  selected_by: string;
  created_at: string;
}

export interface Store {
  // Design revision manager
  users: User[];
  projects: Project[];
  feedback: Feedback[];
  design_versions: DesignVersion[];
  selections: Selection[];
  // Rorop HQ (work-management super app)
  ventures: Venture[];
  tasks: Task[];
  comments: Comment[];
  knowledge: KnowledgeItem[];
  secretary_messages: SecretaryMessage[];
  briefings: Briefing[];
}

function emptyStore(): Store {
  return {
    users: [],
    projects: [],
    feedback: [],
    design_versions: [],
    selections: [],
    ventures: [],
    tasks: [],
    comments: [],
    knowledge: [],
    secretary_messages: [],
    briefings: [],
  };
}

export const DATA_DIR = process.env.RORO_DATA_DIR || path.join(process.cwd(), "data");
export const DATA_FILE = path.join(DATA_DIR, "store.json");

type GlobalWithStore = typeof globalThis & { __roropStore?: Store };
const g = globalThis as GlobalWithStore;

function load(): Store {
  const store = emptyStore();
  if (!fs.existsSync(DATA_FILE)) return store;
  let raw: string;
  try {
    raw = fs.readFileSync(DATA_FILE, "utf8");
  } catch (err) {
    // Unreadable file: never risk overwriting it with an empty store.
    throw new Error(`[db] cannot read ${DATA_FILE}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!raw.trim()) return store;
  try {
    const parsed = JSON.parse(raw) as Partial<Store>;
    const target = store as unknown as Record<string, unknown[]>;
    const source = parsed as unknown as Record<string, unknown>;
    for (const key of Object.keys(store)) {
      const value = source[key];
      if (Array.isArray(value)) target[key] = value;
    }
  } catch (err) {
    // Corrupt JSON: keep the original for recovery and start empty.
    const backup = `${DATA_FILE}.corrupt-${Date.now()}`;
    fs.renameSync(DATA_FILE, backup);
    console.error(`[db] ${DATA_FILE} is not valid JSON; moved it to ${backup} and starting empty:`, err);
  }
  return store;
}

export function getStore(): Store {
  if (!g.__roropStore) g.__roropStore = load();
  return g.__roropStore;
}

/**
 * Write the store to disk atomically (tmp file + rename). Throws when the write
 * fails so the API route reports an error instead of pretending the change is saved.
 */
export function persist(): void {
  const store = getStore();
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store), "utf8");
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error(`[db] failed to persist ${DATA_FILE}:`, err);
    throw new Error("데이터를 디스크에 저장하지 못했습니다. 서버의 data 폴더 권한과 디스크 용량을 확인하세요.");
  }
}

/** Test/dev helper: drop everything in memory and on disk. */
export function resetStore(): void {
  g.__roropStore = emptyStore();
  persist();
}
