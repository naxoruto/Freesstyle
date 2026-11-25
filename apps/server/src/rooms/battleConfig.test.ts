import { describe, expect, it } from "vitest";
import type { BattleModeConfig } from "@freestyle/shared";
import {
  BATTLE_PRESETS,
  FORMAT_DEFAULTS,
  VOTING_COMPATIBILITY,
  VOTING_METHODS,
  REPLICA_RULES,
  createDefaultConfig,
  isManualFormat,
  normalizeConfig,
  validateConfig,
} from "@freestyle/shared";

describe("FORMAT_DEFAULTS", () => {
  it("1x1 is countdown with one entry per MC", () => {
    expect(FORMAT_DEFAULTS["1x1"]).toMatchObject({
      entriesPerParticipant: 1,
      timerMode: "countdown",
      defaultRounds: 3,
    });
  });

  it("4x4 is manual with 4 entries per MC", () => {
    expect(FORMAT_DEFAULTS["4x4"]).toMatchObject({
      entriesPerParticipant: 4,
      timerMode: "manual",
      turnStructure: "one_way",
    });
  });

  it("8x8 is manual with 8 entries per MC", () => {
    expect(FORMAT_DEFAULTS["8x8"]).toMatchObject({
      entriesPerParticipant: 8,
      timerMode: "manual",
      turnStructure: "one_way",
    });
  });

  it("manual formats force one_way turn structure", () => {
    expect(FORMAT_DEFAULTS["4x4"].turnStructure).toBe("one_way");
    expect(FORMAT_DEFAULTS["8x8"].turnStructure).toBe("one_way");
  });
});

describe("VOTING_METHODS", () => {
  it("rubrica evaluates 5 dimensions and is not per-entry", () => {
    expect(VOTING_METHODS.rubrica).toMatchObject({
      perEntry: false,
      requiresExtra: false,
      dimensions: 5,
      scoreRange: { min: 0, max: 10 },
    });
  });

  it("patron evaluates per entry with extra votes at the end", () => {
    expect(VOTING_METHODS.patron).toMatchObject({
      perEntry: true,
      requiresExtra: true,
      dimensions: 1,
      scoreRange: { min: 0, max: 4 },
    });
  });

  it("room vote selects one winner without judge-only scoring", () => {
    expect(VOTING_METHODS.room_vote).toMatchObject({
      perEntry: false,
      requiresExtra: false,
      dimensions: 1,
      scoreRange: { min: 0, max: 1 },
    });
  });
});

describe("VOTING_COMPATIBILITY", () => {
  it("countdown only supports rubrica", () => {
    expect(VOTING_COMPATIBILITY.countdown).toEqual(["rubrica", "free_vote", "room_vote"]);
  });

  it("manual supports both rubrica and patron", () => {
    expect(VOTING_COMPATIBILITY.manual).toEqual(["rubrica", "patron", "free_vote", "room_vote"]);
  });
});

describe("REPLICA_RULES", () => {
  it("allows 1 to 5 replicas with tie range 0-100", () => {
    expect(REPLICA_RULES.minMaxReplicas).toBe(1);
    expect(REPLICA_RULES.maxMaxReplicas).toBe(5);
    expect(REPLICA_RULES.minTieRange).toBe(0);
    expect(REPLICA_RULES.maxTieRange).toBe(100);
  });

  it("replica config is independent from original battle", () => {
    expect(REPLICA_RULES.independentConfig).toBe(true);
  });
});

describe("createDefaultConfig", () => {
  it("returns a valid config for clasico 1x1", () => {
    const config = createDefaultConfig("clasico", "1x1");
    expect(config.mode).toBe("clasico");
    expect(config.format).toBe("1x1");
    expect(config.timerMode).toBe("countdown");
    expect(config.entriesPerParticipant).toBe(1);
    expect(config.liveControlEnabled).toBe(true);
  });

  it("returns a valid config for clasico 4x4", () => {
    const config = createDefaultConfig("clasico", "4x4");
    expect(config.timerMode).toBe("manual");
    expect(config.entriesPerParticipant).toBe(4);
  });

  it("defaults to 1x1 when no format specified", () => {
    const config = createDefaultConfig("libre");
    expect(config.format).toBe("1x1");
  });
});

describe("normalizeConfig", () => {
  it("fills missing fields from format defaults", () => {
    const config = normalizeConfig({}, "clasico");
    expect(config.format).toBe("1x1");
    expect(config.rounds).toBe(3);
    expect(config.timerMode).toBe("countdown");
    expect(config.liveControlEnabled).toBe(true);
  });

  it("respects explicitly provided values", () => {
    const config = normalizeConfig({ format: "4x4", rounds: 2, votingSystem: "patron" }, "clasico");
    expect(config.format).toBe("4x4");
    expect(config.rounds).toBe(2);
    expect(config.votingSystem).toBe("patron");
    expect(config.timerMode).toBe("manual");
  });
});

describe("validateConfig", () => {
  const validConfig = (): BattleModeConfig => createDefaultConfig("clasico", "1x1");

  it("accepts a valid default config", () => {
    expect(validateConfig(validConfig())).toEqual({ valid: true, errors: [] });
  });

  it("rejects invalid mode", () => {
    const config = { ...validConfig(), mode: "inventado" as any };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Modo"))).toBe(true);
  });

  it("accepts the variado mode", () => {
    const config: BattleModeConfig = { ...validConfig(), mode: "variado" };
    expect(validateConfig(config)).toEqual({ valid: true, errors: [] });
  });

  it("rejects invalid format", () => {
    const config = { ...validConfig(), format: "2x2" as any };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Formato"))).toBe(true);
  });

  it("rejects rounds out of range", () => {
    const config = { ...validConfig(), rounds: 10 };
    expect(validateConfig(config).valid).toBe(false);
  });

  it("rejects invalid timer mode", () => {
    const config = { ...validConfig(), timerMode: "auto" as any };
    expect(validateConfig(config).valid).toBe(false);
  });

  it("rejects patron with countdown timer", () => {
    const config: BattleModeConfig = { ...validConfig(), timerMode: "countdown", votingSystem: "patron" };
    expect(validateConfig(config).valid).toBe(false);
    expect(validateConfig(config).errors.some((e) => e.includes("compatible"))).toBe(true);
  });

  it("accepts patron with manual timer", () => {
    const config: BattleModeConfig = { ...validConfig(), format: "4x4", timerMode: "manual", votingSystem: "patron", entriesPerParticipant: 4 };
    expect(validateConfig(config)).toEqual({ valid: true, errors: [] });
  });

  it("rejects manual with round_trip turn structure", () => {
    const config: BattleModeConfig = { ...validConfig(), format: "4x4", timerMode: "manual", turnStructure: "round_trip" };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("turnStructure"))).toBe(true);
  });

  it("rejects timePerTurn outside countdown options", () => {
    const config = { ...validConfig(), timePerTurn: 42 };
    expect(validateConfig(config).valid).toBe(false);
  });

  it("accepts valid countdown times", () => {
    for (const time of [30, 45, 60, 90, 120]) {
      const config = { ...validConfig(), timePerTurn: time };
      expect(validateConfig(config).valid).toBe(true);
    }
  });
});

describe("isManualFormat", () => {
  it("returns false for 1x1", () => {
    expect(isManualFormat("1x1")).toBe(false);
  });

  it("returns true for 4x4 and 8x8", () => {
    expect(isManualFormat("4x4")).toBe(true);
    expect(isManualFormat("8x8")).toBe(true);
  });
});

describe("BATTLE_PRESETS", () => {
  it("defines three valid presets", () => {
    const ids = Object.keys(BATTLE_PRESETS) as (keyof typeof BATTLE_PRESETS)[];
    expect(ids).toHaveLength(3);
    for (const id of ids) {
      expect(validateConfig(BATTLE_PRESETS[id].config)).toEqual({ valid: true, errors: [] });
    }
  });

  it("variado alterna libre y concepto", () => {
    expect(BATTLE_PRESETS.variado.summary).toContain("alterna libre y con concepto");
    expect(BATTLE_PRESETS.variado.config.mode).toBe("variado");
  });

  it("rapida es una ronda libre con voto libre", () => {
    expect(BATTLE_PRESETS.rapida.config).toMatchObject({ mode: "libre", rounds: 1, votingSystem: "free_vote" });
  });

  it("por_entradas es 4x4 manual con patrón", () => {
    expect(BATTLE_PRESETS.por_entradas.config).toMatchObject({ mode: "clasico", format: "4x4", timerMode: "manual", votingSystem: "patron" });
  });
});
