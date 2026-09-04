import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAuto,
  deleteSlot,
  deserializeSave,
  hasAutosave,
  listSlots,
  loadAuto,
  loadEndings,
  loadSettings,
  loadSlot,
  recordEnding,
  saveAuto,
  saveSettings,
  saveSlot,
  serializeSave,
  slotKey,
} from "../save";
import { GAME_VERSION } from "../types";
import { mutate, newGame } from "./helpers";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

interface GlobalWithStorage {
  localStorage?: MemoryStorage;
}

function setStorage(storage: MemoryStorage | undefined): void {
  (globalThis as unknown as GlobalWithStorage).localStorage = storage;
}

beforeEach(() => {
  setStorage(new MemoryStorage());
});

describe("직렬화", () => {
  it("serialize → deserialize 왕복이 동일하다", () => {
    const state = newGame({ seed: 999 });
    const file = deserializeSave(serializeSave(state));
    expect(file).not.toBeNull();
    expect(file?.version).toBe(GAME_VERSION);
    expect(file?.state).toEqual(state);
  });

  it("버전이 다르면 불러오기를 거부한다", () => {
    const raw = JSON.parse(serializeSave(newGame())) as { version: number };
    raw.version = GAME_VERSION + 1;
    expect(deserializeSave(JSON.stringify(raw))).toBeNull();
  });

  it("망가진 JSON 은 null 을 돌려준다", () => {
    expect(deserializeSave("{이건 JSON 이 아니다")).toBeNull();
    expect(deserializeSave("null")).toBeNull();
    expect(deserializeSave("[]")).toBeNull();
  });
});

describe("자동 저장", () => {
  it("저장하고 다시 읽으면 같은 상태다", () => {
    const state = newGame({ seed: 3 });
    expect(hasAutosave()).toBe(false);
    expect(saveAuto(state)).toBe(true);
    expect(hasAutosave()).toBe(true);
    expect(loadAuto()).toEqual(state);
    clearAuto();
    expect(loadAuto()).toBeNull();
  });
});

describe("수동 슬롯", () => {
  it("슬롯 저장·불러오기·삭제와 메타 요약", () => {
    const state = mutate(newGame({ seed: 3 }), (d) => {
      d.month = 7;
      d.idol.name = "서하람";
      d.idol.social.fans = 12_345;
    });
    expect(saveSlot(2, state)).toBe(true);
    expect(loadSlot(2)?.month).toBe(7);

    const metas = listSlots();
    expect(metas[0]).toBeNull();
    expect(metas[1]?.slot).toBe(2);
    expect(metas[1]?.name).toBe("서하람");
    expect(metas[1]?.fans).toBe(12_345);
    expect(metas[1]?.phase).toBe("trainee");
    expect(metas[2]).toBeNull();

    deleteSlot(2);
    expect(loadSlot(2)).toBeNull();
  });

  it("슬롯 키 규약", () => {
    expect(slotKey(1)).toBe("idolboy.slot.1");
    expect(slotKey(3)).toBe("idolboy.slot.3");
  });
});

describe("엔딩 도감", () => {
  it("같은 엔딩은 최신 기록만 남는다", () => {
    const first = mutate(newGame(), (d) => {
      d.ending = { id: "top_idol", month: 36 };
    });
    recordEnding(first);
    const second = mutate(first, (d) => {
      d.idol.name = "다른 이름";
    });
    recordEnding(second);
    const list = loadEndings();
    expect(list).toHaveLength(1);
    expect(list[0].idolName).toBe("다른 이름");

    const other = mutate(newGame(), (d) => {
      d.ending = { id: "solo_vocalist", month: 36 };
    });
    recordEnding(other);
    expect(loadEndings().map((e) => e.id).sort()).toEqual(["solo_vocalist", "top_idol"]);
  });

  it("엔딩이 없는 상태는 기록하지 않는다", () => {
    recordEnding(newGame());
    expect(loadEndings()).toEqual([]);
  });
});

describe("설정", () => {
  it("기본값은 normal 이고 저장·복원된다", () => {
    expect(loadSettings()).toEqual({ speed: "normal" });
    saveSettings({ speed: "fast" });
    expect(loadSettings()).toEqual({ speed: "fast" });
  });
});

describe("저장소가 없을 때", () => {
  it("조용히 실패하고 예외를 던지지 않는다", () => {
    setStorage(undefined);
    expect(saveAuto(newGame())).toBe(false);
    expect(loadAuto()).toBeNull();
    expect(hasAutosave()).toBe(false);
    expect(listSlots()).toEqual([null, null, null]);
    expect(loadEndings()).toEqual([]);
    expect(loadSettings()).toEqual({ speed: "normal" });
  });
});
