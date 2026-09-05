/**
 * 저장 — localStorage 래퍼 (브라우저 전용, 엔진과 분리).
 * 모든 접근은 try/catch. 저장소가 없으면(SSR·프라이빗 모드) 조용히 실패한다.
 */

import { GAME_VERSION } from "./types";
import type {
  EndingGalleryEntry,
  GameSettings,
  GameState,
  SaveFile,
  SaveSlotMeta,
} from "./types";

export const SAVE_KEY_AUTO = "idolboy.autosave";
export const SAVE_KEY_ENDINGS = "idolboy.endings";
export const SAVE_KEY_SETTINGS = "idolboy.settings";
export const SAVE_KEY_ALBUM = "idolboy.album";
export const SAVE_SLOTS = [1, 2, 3] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

export function slotKey(slot: number): string {
  return `idolboy.slot.${slot}`;
}

const DEFAULT_SETTINGS: GameSettings = { speed: "normal" };

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (!ls) return null;
    return ls;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 직렬화
// ---------------------------------------------------------------------------

export function serializeSave(state: GameState): string {
  const file: SaveFile = {
    version: GAME_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(file);
}

function isSaveFile(value: unknown): value is SaveFile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SaveFile>;
  return (
    typeof candidate.version === "number" &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.state === "object" &&
    candidate.state !== null
  );
}

/** 버전이 다르면 null (마이그레이션은 v2부터) */
export function deserializeSave(json: string): SaveFile | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isSaveFile(parsed)) return null;
    if (parsed.version !== GAME_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 읽기/쓰기
// ---------------------------------------------------------------------------

function write(key: string, value: string): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function read(key: string): string | null {
  const ls = storage();
  if (!ls) return null;
  try {
    return ls.getItem(key);
  } catch {
    return null;
  }
}

function remove(key: string): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function saveTo(key: string, state: GameState): boolean {
  return write(key, serializeSave(state));
}

export function loadFrom(key: string): SaveFile | null {
  const raw = read(key);
  if (!raw) return null;
  return deserializeSave(raw);
}

// ---------------------------------------------------------------------------
// 자동 저장 / 슬롯
// ---------------------------------------------------------------------------

export function saveAuto(state: GameState): boolean {
  return saveTo(SAVE_KEY_AUTO, state);
}

export function loadAuto(): GameState | null {
  return loadFrom(SAVE_KEY_AUTO)?.state ?? null;
}

export function hasAutosave(): boolean {
  return read(SAVE_KEY_AUTO) !== null;
}

export function clearAuto(): boolean {
  return remove(SAVE_KEY_AUTO);
}

export function saveSlot(slot: number, state: GameState): boolean {
  return saveTo(slotKey(slot), state);
}

export function loadSlot(slot: number): GameState | null {
  return loadFrom(slotKey(slot))?.state ?? null;
}

export function deleteSlot(slot: number): boolean {
  return remove(slotKey(slot));
}

export function getSlotMeta(slot: number): SaveSlotMeta | null {
  const file = loadFrom(slotKey(slot));
  if (!file) return null;
  const state = file.state;
  return {
    slot,
    name: state.idol.name,
    month: state.month,
    phase: state.career.phase,
    fans: state.idol.social.fans,
    savedAt: file.savedAt,
  };
}

export function listSlots(): Array<SaveSlotMeta | null> {
  return SAVE_SLOTS.map((slot) => getSlotMeta(slot));
}

// ---------------------------------------------------------------------------
// 엔딩 도감
// ---------------------------------------------------------------------------

function isGalleryEntry(value: unknown): value is EndingGalleryEntry {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Partial<EndingGalleryEntry>;
  return typeof c.id === "string" && typeof c.idolName === "string" && typeof c.month === "number";
}

export function loadEndings(): EndingGalleryEntry[] {
  const raw = read(SAVE_KEY_ENDINGS);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGalleryEntry);
  } catch {
    return [];
  }
}

/** 같은 엔딩 id 는 최신 기록만 남긴다 */
export function recordEnding(state: GameState): EndingGalleryEntry[] {
  if (!state.ending) return loadEndings();
  const entry: EndingGalleryEntry = {
    id: state.ending.id,
    idolName: state.idol.name,
    month: state.ending.month,
    achievedAt: new Date().toISOString(),
  };
  const list = loadEndings().filter((e) => e.id !== entry.id);
  list.push(entry);
  write(SAVE_KEY_ENDINGS, JSON.stringify(list));
  return list;
}

export function clearEndings(): boolean {
  return remove(SAVE_KEY_ENDINGS);
}

// ---------------------------------------------------------------------------
// 포토카드 앨범 (04_UI_REDESIGN 2.2)
// ---------------------------------------------------------------------------

/** 획득한 포토카드 id 목록 (중복 없음, 획득 순서 유지) */
export function loadAlbum(): string[] {
  const raw = read(SAVE_KEY_ALBUM);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const value of parsed) {
      if (typeof value === "string" && !out.includes(value)) out.push(value);
    }
    return out;
  } catch {
    return [];
  }
}

/** 카드를 연다. 반환값은 **이번에 새로 열린 것만** (연출·토스트용) */
export function unlockCards(ids: string[]): string[] {
  if (ids.length === 0) return [];
  const owned = loadAlbum();
  const gained: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0) continue;
    if (owned.includes(id) || gained.includes(id)) continue;
    gained.push(id);
  }
  if (gained.length === 0) return [];
  write(SAVE_KEY_ALBUM, JSON.stringify([...owned, ...gained]));
  return gained;
}

export function clearAlbum(): boolean {
  return remove(SAVE_KEY_ALBUM);
}

// ---------------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------------

export function loadSettings(): GameSettings {
  const raw = read(SAVE_KEY_SETTINGS);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const speed = (parsed as Partial<GameSettings>).speed;
      if (speed === "fast" || speed === "normal") return { speed };
    }
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: GameSettings): boolean {
  return write(SAVE_KEY_SETTINGS, JSON.stringify(settings));
}
