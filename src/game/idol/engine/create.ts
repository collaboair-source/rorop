/** 새 게임 생성 (GDD 2.3, 2.4, 2.5) */

import { getBackground } from "../data/backgrounds";
import { getPersonality } from "../data/personalities";
import {
  CONCEPT_IDS,
  GAME_VERSION,
  WEEKS_PER_MONTH,
  type ConceptId,
  type GameState,
  type NewGameConfig,
} from "../types";

const DEFAULT_NAME = "서하람";

export function createGame(config: NewGameConfig): GameState {
  const background = getBackground(config.background);
  const personality = getPersonality(config.personality);

  const conceptAffinity = {} as Record<ConceptId, number>;
  for (const id of CONCEPT_IDS) {
    const bonus = personality.conceptBonus[id] ?? 0;
    conceptAffinity[id] = Math.round((background.conceptAffinity[id] + bonus) * 100) / 100;
  }

  const seed = config.seed ?? Date.now();
  const now = new Date().toISOString();
  const name = config.name.trim() === "" ? DEFAULT_NAME : config.name.trim();

  return {
    version: GAME_VERSION,
    seed,
    rngState: seed | 0,
    month: 1,
    idol: {
      name,
      background: background.id,
      personality: personality.id,
      talents: { ...background.talents },
      conceptAffinity,
      skills: { ...background.skills },
      condition: {
        stamina: background.maxStamina,
        maxStamina: background.maxStamina,
        stress: background.startStress,
        injured: false,
        injuredMonthsLeft: 0,
      },
      social: {
        fans: background.startFans,
        bond: background.startBond,
        reputation: background.startReputation,
      },
    },
    career: {
      debuted: false,
      debutMonth: null,
      phase: "trainee",
      comebacks: [],
      awards: [],
      topRankCount: 0,
      nextComebackMonth: null,
      lastComebackMonth: null,
      debutEvalFailures: 0,
      lastDebutEvalMonth: null,
    },
    economy: {
      money: background.startMoney,
      trainerTier: 1,
      supportCutMonthsLeft: 0,
      debtMonthsLeft: 0,
    },
    flags: {},
    seenEvents: {},
    ui: {
      phase: "planning",
      plan: new Array<null>(WEEKS_PER_MONTH).fill(null),
      weekIndex: 0,
      log: [],
      eventsThisMonth: 0,
      pendingEventId: null,
      lastChoiceText: null,
      pendingMonthEnd: false,
      report: null,
      lastDebutEval: null,
      lastComeback: null,
      lastAwards: [],
    },
    history: [],
    ending: null,
    createdAt: now,
    updatedAt: now,
  };
}
