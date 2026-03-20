// In-memory database for MVP (replace with PostgreSQL in production)
// This keeps the MVP simple without requiring a running database

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

// In-memory store
const store = {
  users: [] as User[],
  projects: [] as Project[],
  feedback: [] as Feedback[],
  design_versions: [] as DesignVersion[],
  selections: [] as Selection[],
};

// Seed demo data on first access
let seeded = false;

function seedDemoData() {
  if (seeded) return;
  seeded = true;

  // Demo users are created via registration
  // This function exists as a hook for future seeding
}

export function getStore() {
  seedDemoData();
  return store;
}
