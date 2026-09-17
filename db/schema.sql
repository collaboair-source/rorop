-- Design Revision Management System - Database Schema

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'designer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  client_id TEXT NOT NULL REFERENCES users(id),
  designer_id TEXT NOT NULL REFERENCES users(id),
  revision_limit INTEGER NOT NULL DEFAULT 3,
  revision_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'over_limit')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  style TEXT CHECK (style IN ('luxury', 'minimal', 'trendy', 'bold')),
  color TEXT CHECK (color IN ('bright', 'dark', 'warm', 'cool')),
  focus TEXT CHECK (focus IN ('text', 'image', 'brand')),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE design_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE selections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  selected_version_id TEXT NOT NULL REFERENCES design_versions(id),
  selected_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_designer ON projects(designer_id);
CREATE INDEX idx_feedback_project ON feedback(project_id);
CREATE INDEX idx_versions_project ON design_versions(project_id);
CREATE INDEX idx_selections_project ON selections(project_id);

-- ---------------------------------------------------------------------------
-- Rorop HQ (work-management super app)
-- The running app persists to data/store.json; this is the equivalent
-- relational schema for a future PostgreSQL migration.
-- ---------------------------------------------------------------------------

CREATE TABLE ventures (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('idea', 'active', 'paused', 'done')),
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  goal TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'claude', 'secretary')),
  source_ref TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  venture_id TEXT REFERENCES ventures(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  due_date DATE,
  checklist JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'claude', 'secretary')),
  source_ref TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('venture', 'task', 'knowledge')),
  target_id TEXT NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('user', 'secretary')),
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('conversation', 'project', 'note')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_uuid TEXT,
  source_date TIMESTAMP,
  venture_id TEXT REFERENCES ventures(id) ON DELETE SET NULL,
  summary TEXT NOT NULL DEFAULT '',
  analyzed BOOLEAN NOT NULL DEFAULT FALSE,
  analysis JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, source_uuid)
);

CREATE TABLE secretary_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'secretary')),
  content TEXT NOT NULL,
  proposals JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE briefings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, date)
);

CREATE INDEX idx_ventures_user ON ventures(user_id);
CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_venture ON tasks(venture_id);
CREATE INDEX idx_tasks_due ON tasks(user_id, due_date);
CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_knowledge_user ON knowledge(user_id);
CREATE INDEX idx_secretary_messages_user ON secretary_messages(user_id, created_at);
