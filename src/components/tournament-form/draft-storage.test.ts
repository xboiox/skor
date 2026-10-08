import { describe, expect, it } from "vitest";
import { clearDraft, loadDraft, saveDraft, type DraftStorage } from "./draft-storage";
import { initialFormState } from "./form-state";

function memoryStorage(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const filled = { ...initialFormState("2026-10-03"), name: "Friday", players: ["Andi", "Budi"] };

describe("draft storage", () => {
  it("restores a saved draft with its step", () => {
    const storage = memoryStorage();
    saveDraft(storage, filled, 3);
    expect(loadDraft(storage)).toEqual({ state: filled, step: 3 });
  });

  it("returns null when nothing is saved", () => {
    expect(loadDraft(memoryStorage())).toBeNull();
  });

  it("ignores tampered or outdated data instead of crashing", () => {
    const storage = memoryStorage();
    storage.setItem("skor:create-draft", "not json");
    expect(loadDraft(storage)).toBeNull();
    storage.setItem(
      "skor:create-draft",
      JSON.stringify({ state: { ...filled, courts: "two" }, step: 1 }),
    );
    expect(loadDraft(storage)).toBeNull();
    storage.setItem("skor:create-draft", JSON.stringify({ state: filled, step: 9 }));
    expect(loadDraft(storage)).toBeNull();
  });

  it("clears the draft", () => {
    const storage = memoryStorage();
    saveDraft(storage, filled, 1);
    clearDraft(storage);
    expect(loadDraft(storage)).toBeNull();
  });

  it("never throws when storage is unavailable (private mode, blocked)", () => {
    const broken: DraftStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => saveDraft(broken, filled, 1)).not.toThrow();
    expect(loadDraft(broken)).toBeNull();
    expect(() => clearDraft(broken)).not.toThrow();
  });
});
