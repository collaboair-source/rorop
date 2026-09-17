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
-- 지원사업 크롤러 / 매칭 / AI 가이드
-- (MVP 는 data/support-programs.json 파일 저장소를 쓴다. 운영 DB 이전 시 참고)
-- ---------------------------------------------------------------------------

CREATE TABLE support_programs (
  id TEXT PRIMARY KEY,                       -- `${source}:${external_id}`
  source TEXT NOT NULL CHECK (source IN ('bizinfo', 'kstartup', 'manual')),
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  subcategory TEXT,
  target TEXT,
  target_detail TEXT,
  exclusion TEXT,
  region TEXT,
  business_age TEXT,
  target_age TEXT,
  organization TEXT,
  executing_org TEXT,
  department TEXT,
  apply_start DATE,
  apply_end DATE,
  apply_method TEXT,
  contact TEXT,
  url TEXT,
  hashtags TEXT[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  posted_at DATE,
  content_hash TEXT NOT NULL,
  first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source, external_id)
);

CREATE TABLE business_profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id),
  company_name TEXT,
  description TEXT,
  products TEXT,
  industry TEXT,
  keywords TEXT[] DEFAULT '{}',
  business_type TEXT CHECK (business_type IN ('예비창업자', '개인사업자', '법인')),
  founded_at DATE,
  region TEXT,
  employees INTEGER DEFAULT 0,
  annual_revenue_million_krw INTEGER DEFAULT 0,
  certifications TEXT[] DEFAULT '{}',
  representative_age INTEGER,
  representative_gender TEXT CHECK (representative_gender IN ('male', 'female', '')),
  interests TEXT[] DEFAULT '{}',
  goals TEXT,
  constraints TEXT,
  stretch_tolerance TEXT CHECK (stretch_tolerance IN ('conservative', 'moderate', 'aggressive')),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE program_analyses (
  program_id TEXT PRIMARY KEY REFERENCES support_programs(id) ON DELETE CASCADE,
  profile_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  fit_score INTEGER NOT NULL,
  fit_level TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  summary TEXT,
  eligibility JSONB DEFAULT '[]',
  direct_angles JSONB DEFAULT '[]',
  stretch_angles JSONB DEFAULT '[]',
  requirements_to_acquire JSONB DEFAULT '[]',
  application_guide JSONB DEFAULT '{}',
  risks JSONB DEFAULT '[]',
  next_steps JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crawl_logs (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'cron', 'cli')),
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP NOT NULL,
  results JSONB DEFAULT '[]',
  new_program_ids TEXT[] DEFAULT '{}',
  analyzed_program_ids TEXT[] DEFAULT '{}',
  notified BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_support_programs_apply_end ON support_programs(apply_end);
CREATE INDEX idx_support_programs_source ON support_programs(source);
