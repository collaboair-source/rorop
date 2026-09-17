// 지원사업 데이터 저장소.
// - 기본: JSON 파일 (SUPPORT_DATA_DIR, 기본값 ./data) 에 저장해 서버 재시작 후에도 유지
// - 파일 쓰기가 불가능한 환경(읽기 전용 FS)에서는 메모리로 동작하며 경고를 남긴다
// - 운영 DB로 옮길 때는 db/schema.sql 의 support_* 테이블을 참고

import fs from "fs";
import path from "path";
import type { BusinessProfile, CrawlLog, ProgramAnalysis, SupportProgram } from "./types";
import { DEFAULT_PROFILE } from "./profile-default";
import { sha1 } from "./text";

interface SupportData {
  version: 1;
  programs: Record<string, SupportProgram>;
  profile: BusinessProfile;
  analyses: Record<string, ProgramAnalysis>;
  crawl_logs: CrawlLog[];
}

interface StoreState {
  data: SupportData;
  file: string | null;
  loaded: boolean;
  persistError: string | null;
}

const MAX_CRAWL_LOGS = 50;

declare global {
  // Next.js dev 모드의 핫리로드에서도 하나의 인스턴스를 유지
  var __supportStore: StoreState | undefined;
}

function emptyData(): SupportData {
  return { version: 1, programs: {}, profile: { ...DEFAULT_PROFILE }, analyses: {}, crawl_logs: [] };
}

function resolveDataFile(): string {
  const dir = process.env.SUPPORT_DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dir, "support-programs.json");
}

function load(): StoreState {
  const file = resolveDataFile();
  const state: StoreState = { data: emptyData(), file, loaded: true, persistError: null };
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw) as Partial<SupportData>;
      state.data = {
        version: 1,
        programs: parsed.programs || {},
        profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
        analyses: parsed.analyses || {},
        crawl_logs: parsed.crawl_logs || [],
      };
    }
  } catch (err) {
    state.persistError = `데이터 파일을 읽지 못했습니다: ${(err as Error).message}`;
    console.warn("[support-store]", state.persistError);
  }
  return state;
}

function getState(): StoreState {
  if (!globalThis.__supportStore) {
    globalThis.__supportStore = load();
  }
  return globalThis.__supportStore;
}

function persist(state: StoreState) {
  if (!state.file) return;
  try {
    fs.mkdirSync(path.dirname(state.file), { recursive: true });
    const tmp = `${state.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state.data, null, 2), "utf8");
    fs.renameSync(tmp, state.file);
    state.persistError = null;
  } catch (err) {
    // 읽기 전용 파일시스템(Vercel 등)에서는 메모리로만 동작
    state.persistError = `데이터를 파일에 저장하지 못했습니다 (메모리로만 동작 중): ${(err as Error).message}`;
    console.warn("[support-store]", state.persistError);
  }
}

// ---------- programs ----------

export function listPrograms(): SupportProgram[] {
  return Object.values(getState().data.programs);
}

export function getProgram(id: string): SupportProgram | null {
  return getState().data.programs[id] || null;
}

export interface UpsertResult {
  added: number;
  updated: number;
  unchanged: number;
  added_ids: string[];
  updated_ids: string[];
}

/** 크롤링 결과를 병합. content_hash 가 같으면 last_seen_at 만 갱신 */
export function upsertPrograms(incoming: SupportProgram[], now = new Date().toISOString()): UpsertResult {
  const state = getState();
  const result: UpsertResult = { added: 0, updated: 0, unchanged: 0, added_ids: [], updated_ids: [] };
  for (const p of incoming) {
    const existing = state.data.programs[p.id];
    if (!existing) {
      state.data.programs[p.id] = { ...p, first_seen_at: now, last_seen_at: now, updated_at: now };
      result.added += 1;
      result.added_ids.push(p.id);
    } else if (existing.content_hash !== p.content_hash) {
      state.data.programs[p.id] = { ...existing, ...p, first_seen_at: existing.first_seen_at, last_seen_at: now, updated_at: now };
      result.updated += 1;
      result.updated_ids.push(p.id);
    } else {
      existing.last_seen_at = now;
      result.unchanged += 1;
    }
  }
  persist(state);
  return result;
}

export function saveProgram(program: SupportProgram) {
  const state = getState();
  state.data.programs[program.id] = program;
  persist(state);
}

export function deleteProgram(id: string): boolean {
  const state = getState();
  if (!state.data.programs[id]) return false;
  delete state.data.programs[id];
  delete state.data.analyses[id];
  persist(state);
  return true;
}

// ---------- profile ----------

export function getProfile(): BusinessProfile {
  return getState().data.profile;
}

export function saveProfile(profile: BusinessProfile) {
  const state = getState();
  state.data.profile = { ...profile, updated_at: new Date().toISOString() };
  persist(state);
  return state.data.profile;
}

/** 프로필 내용 해시 — 분석 결과가 어떤 프로필 기준인지 표시 */
export function profileHash(profile: BusinessProfile): string {
  const { updated_at: _ignored, ...rest } = profile;
  void _ignored;
  return sha1(JSON.stringify(rest)).slice(0, 12);
}

// ---------- analyses ----------

export function getAnalysis(programId: string): ProgramAnalysis | null {
  return getState().data.analyses[programId] || null;
}

export function listAnalyses(): Record<string, ProgramAnalysis> {
  return getState().data.analyses;
}

export function saveAnalysis(analysis: ProgramAnalysis) {
  const state = getState();
  state.data.analyses[analysis.program_id] = analysis;
  persist(state);
}

// ---------- crawl logs ----------

export function listCrawlLogs(): CrawlLog[] {
  return getState().data.crawl_logs;
}

export function addCrawlLog(log: CrawlLog) {
  const state = getState();
  state.data.crawl_logs.unshift(log);
  if (state.data.crawl_logs.length > MAX_CRAWL_LOGS) state.data.crawl_logs.length = MAX_CRAWL_LOGS;
  persist(state);
}

// ---------- misc ----------

export function storeInfo() {
  const state = getState();
  return {
    file: state.file,
    persist_error: state.persistError,
    programs: Object.keys(state.data.programs).length,
    analyses: Object.keys(state.data.analyses).length,
  };
}

/** 테스트용: 메모리 상태 초기화 (파일은 건드리지 않음) */
export function __resetStoreForTests(file: string | null = null) {
  globalThis.__supportStore = { data: emptyData(), file, loaded: true, persistError: null };
}
